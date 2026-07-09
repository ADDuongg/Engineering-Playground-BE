# Feature Specification: SQL Execution Queue

**Feature Branch**: `013-sql-execution-queue`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Route interactive SQL experiment execution through an async job queue so API requests stay non-blocking under concurrent load and playground connection pressure is bounded. Reuse the shared Worker Queue Foundation: enqueue Experiment Runner jobs instead of executing synchronously in the handler, expose a consistent SQL-run job lifecycle (queued → running → completed → failed → cancelled), deduplicate per-session in-flight runs, bound worker concurrency to playground pool capacity, let learners poll job status/results, offer an optional feature-flagged sync fast-path when queue depth is low, and propagate sandbox timeout/cancellation to queued jobs (SYSTEM_DESIGN §18, ENGINEERING_GUIDE §14, BACKLOG SQL Execution Queue)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-09

- Q: How should a completed SQL run's results (rows + metrics) reach the learner? → A: Embed rows + metrics in the shared job-status result payload once completed, bounded by the sandbox row cap (single poll surface).
- Q: When a session already has an in-flight SQL run and submits another, what should happen? → A: Reject the new run with an actionable in-flight-limit error (mirrors the benchmark inflight-limit pattern).
- Q: Should the optional feature-flagged synchronous fast-path be built in this feature? → A: No — defer it; ship queue-only now. The fast-path is out of scope for this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Interactive SQL Runs Without Blocking the API (Priority: P1)

A learner in a Database Track lab writes a query and runs it. Under normal single-user conditions the result feels immediate, but when many learners run queries at once (or a query is slow), the platform accepts the run request quickly and processes the SQL on a bounded pool of background workers instead of tying up the HTTP request. The learner's lab UI stays responsive; they receive a run reference and observe the run move through its lifecycle until results and metrics are available.

**Why this priority**: Synchronous SQL execution is the last major blocking path on the API. Under concurrent load it exhausts the playground connection pool and makes every learner's request slow. Moving execution behind a bounded queue protects platform responsiveness and is the core value of this feature.

**Independent Test**: Submit an SQL run through the enqueue path and verify the HTTP response returns a run reference (not full results) before execution finishes, then poll run status until it reports completion with the query results and metrics.

**Acceptance Scenarios**:

1. **Given** a learner submits a valid SQL run for a ready session and dataset, **When** the platform accepts it, **Then** the response returns a run reference with status `queued` without waiting for the query to execute.
2. **Given** an accepted SQL run, **When** a worker is available, **Then** the query executes outside the accepting HTTP request against the correct isolated playground schema.
3. **Given** a completed SQL run, **When** the learner polls run status, **Then** they receive the query result rows and backend-computed metrics for that run.
4. **Given** a learner submits an SQL run, **When** they poll the shared job status surface with the run identifier, **Then** they receive the current lifecycle state (`queued`, `running`, `completed`, `failed`, or `cancelled`).

---

### User Story 2 - Bounded Concurrency Protects Playground Capacity (Priority: P1)

Platform operators need assurance that a spike in SQL runs cannot overwhelm the shared Playground PostgreSQL connection pool. The queue processes SQL runs under a configured maximum worker concurrency aligned with pool capacity; excess runs wait in the queue rather than opening unbounded connections. Learners still get feedback that their run is queued and progressing.

**Why this priority**: Fair, bounded resource use is the reason to introduce the queue. Without a concurrency ceiling, async execution would still let load spikes exhaust the playground and degrade every session.

**Independent Test**: Submit more concurrent SQL runs than the configured worker concurrency and verify that the number of simultaneously executing queries never exceeds the limit, while queued runs eventually complete.

**Acceptance Scenarios**:

1. **Given** more pending SQL runs than the configured concurrency limit, **When** workers process the backlog, **Then** the number of concurrently executing queries never exceeds the configured limit.
2. **Given** the concurrency limit is reached, **When** additional runs are submitted, **Then** those runs remain `queued` and are processed as capacity frees up.
3. **Given** queued work is waiting, **When** operators inspect observability signals, **Then** queue depth and wait-time metrics for SQL runs are available.

---

### User Story 3 - Duplicate In-Flight Runs Are Prevented Per Session (Priority: P2)

A learner (or a repeated/double-clicked request) should not stack multiple simultaneous SQL runs for the same experiment session and exhaust their share of capacity. When a run is already in flight for a session, a new submission for that same session is rejected with an actionable message until the in-flight run finishes.

**Why this priority**: Prevents accidental self-inflicted queue flooding and keeps per-learner behavior predictable. It mirrors the existing benchmark inflight-limit pattern, so it is a consistency and fairness safeguard rather than the core capability.

**Independent Test**: Submit two SQL runs for the same session back-to-back and verify the second is rejected with a clear "run already in progress" style outcome while the first proceeds; after the first completes, a new run is accepted.

**Acceptance Scenarios**:

1. **Given** an SQL run is already `queued` or `running` for a session, **When** a second run is submitted for that same session, **Then** it is rejected with an actionable in-flight-limit message and no second job is created.
2. **Given** the in-flight run for a session reaches a terminal state, **When** the learner submits a new run, **Then** it is accepted normally.

---

### User Story 4 - Timeouts and Cancellation Propagate to Queued Runs (Priority: P2)

Sandbox limits that protect the platform (query timeout, blocked statements, resource caps) must apply to queued SQL runs exactly as they do to synchronous execution. If a learner's experiment session is torn down, any queued or running SQL run for that session is cancelled rather than left to execute against a schema that is going away.

**Why this priority**: Async execution must not become a loophole around sandbox safety or leave orphaned work. This protects platform stability and gives learners consistent, educational error messaging regardless of execution path.

**Independent Test**: (a) Enqueue a run that exceeds the sandbox query timeout and verify it finalizes as a categorized timeout failure with an educational message; (b) tear down a session with an in-flight run and verify the run moves to `cancelled` and does not execute.

**Acceptance Scenarios**:

1. **Given** a queued SQL run whose query exceeds the sandbox timeout, **When** the worker executes it, **Then** the run finalizes as `failed` with a timeout failure category and an actionable, learning-oriented message.
2. **Given** a queued SQL run that violates sandbox rules (blocked statement, non-parameterized input), **When** it is validated, **Then** it is rejected as a non-retryable validation failure and is not retried.
3. **Given** an in-flight SQL run for a session, **When** that session is torn down, **Then** the run is cancelled and its final status reflects cancellation.

---

### Edge Cases

- **Worker crash mid-run**: The run is retried according to policy or dead-lettered when attempts are exhausted; no run stays `running` forever without a timeout bound.
- **Duplicate worker claim**: Only one worker actively executes a given run at a time (foundation lease/lock semantics); SQL execution side effects (e.g. index create/drop within a session) must be safe under at-most-once active processing.
- **Malformed or oversized payload**: The run fails as a non-retryable validation failure and does not poison the worker loop.
- **Result too large to return inline**: The result is bounded by the sandbox row cap; when truncated, the learner is told results were truncated and why.
- **Session expires between enqueue and execution**: The worker detects the session is no longer ready and finalizes the run with a categorized session-unavailable failure rather than executing against an invalid schema.
- **Status polled for a run the learner does not own**: Access is denied; a learner can only read status/results for their own runs.
- **Queue backend unavailable at enqueue**: The submission fails fast with a clear service-unavailable outcome and no half-created run.
- **Rate limit reached**: SQL-run rate limits still apply; an over-limit submission is rejected with retry-after guidance before a job is created.
- **Learner navigates away before completion**: The run continues and results remain retrievable by run identifier until status retention expires.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept interactive SQL experiment runs asynchronously and MUST NOT block the HTTP response until query execution completes (default path).
- **FR-002**: System MUST enqueue SQL runs onto the shared Worker Queue Foundation using a dedicated SQL-execution queue (separate queue per job type, shared enqueue/status/retry/dead-letter primitives).
- **FR-003**: System MUST execute enqueued SQL through the existing sandboxed execution and metrics path so validation, timeout, resource limits, and metric computation are identical to the current synchronous behavior (no divergent SQL execution logic).
- **FR-004**: System MUST expose the SQL-run lifecycle via the shared job status surface with states `queued`, `running`, `completed`, `failed`, and `cancelled`.
- **FR-005**: Learners MUST be able to submit an SQL run via a feature-owned enqueue endpoint that returns a run/job identifier and initial `queued` status.
- **FR-006**: Learners MUST be able to retrieve the results (result rows and backend-computed metrics) of a completed SQL run by its identifier; the completed result payload MUST be delivered embedded in the shared job-status result surface (bounded by the sandbox row cap), not via a separate result-fetch endpoint.
- **FR-007**: System MUST allow learners to retrieve status/results only for their own runs and MUST prevent access to other learners' runs (ownership by user or owning session).
- **FR-008**: System MUST process SQL runs under a configurable maximum worker concurrency intended to be aligned with the playground connection-pool capacity.
- **FR-009**: System MUST reject a new SQL run for a session when an in-flight (`queued` or `running`) SQL run already exists for that same session, returning an actionable in-flight-limit outcome (per-session in-flight limit configurable; default 1).
- **FR-010**: System MUST enforce all sandbox rules for queued runs (parameterized-only, blocked-statement rejection, per-query timeout, resource caps) and MUST treat sandbox validation failures as non-retryable.
- **FR-011**: System MUST finalize runs that exceed the sandbox query timeout as `failed` with a timeout failure category and an actionable, learning-oriented message.
- **FR-012**: System MUST cancel queued or running SQL runs for a session when that session is torn down (via internal lifecycle), transitioning them to `cancelled` so they do not execute against a removed schema.
- **FR-013**: System MUST fail fast with a clear service-unavailable outcome when a run must be enqueued but the queue backend is unavailable, with no half-created run.
- **FR-014**: System MUST apply existing per-user SQL-run rate limits at the enqueue boundary before a job is created.
- **FR-015**: System MUST emit observability signals for SQL-run enqueue, start, completion, failure, retry, cancellation, plus queue depth and wait-time metrics for the SQL-execution queue.
- **FR-016**: System MUST retry only failures explicitly classified as retryable (e.g. transient infrastructure), and MUST move runs that exhaust retries into the dead-letter path with categorized context (job type, run id, failure category, attempt count, owning session/user where available).
- **FR-017**: SQL-run job handling MUST be safe under at-most-once active processing; any run whose side effects are not naturally idempotent MUST be handled so that a retry cannot corrupt session state.
- **FR-018**: System MUST return an educational, truncation-aware result when a result set exceeds the sandbox row cap (learner is told results were truncated).
- **FR-019**: SQL-run status records (including the embedded completed result) MUST be retained for a configurable period after completion so learners can retrieve results after transient disconnects, consistent with existing job-status retention.

### Key Entities

- **SQL Run Job**: A unit of interactive SQL execution work with identifier, job type (`sql-execution`), owning learner and session, submitted SQL/parameters (referenced, not sensitive-leaking in summaries), lifecycle status, timestamps, attempt count, and optional failure category/message.
- **SQL Run Result**: The completed output of a run — result rows (bounded by row cap, with truncation flag) and backend-computed metrics — embedded in the run's job-status result payload and retrievable by run identifier.
- **SQL Execution Queue**: The dedicated queue/topic for SQL runs, distinct from benchmark and dataset-reset queues, with its own concurrency, timeout, and retry configuration.
- **Per-Session In-Flight Limit**: The rule bounding how many SQL runs a single session may have active at once (default 1; duplicate submissions are rejected).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of SQL-run submissions return a run reference within 2 seconds under normal load, regardless of how long the query takes to execute (verified by acceptance tests).
- **SC-002**: Under a submission burst exceeding the configured worker concurrency, the number of queries executing simultaneously never exceeds the configured concurrency limit (verified in a concurrency test).
- **SC-003**: A second SQL run submitted for a session that already has an in-flight run is rejected 100% of the time with an actionable in-flight-limit outcome, and a new run is accepted after the first reaches a terminal state.
- **SC-004**: Queued SQL runs produce results and metrics identical to the current synchronous path for the same input, dataset, and session (verified by parity tests across at least the SELECT, EXPLAIN, and index create/drop statement kinds).
- **SC-005**: A run whose query exceeds the sandbox timeout finalizes as a categorized timeout failure (not an opaque hang) 100% of the time in a controlled timeout test.
- **SC-006**: Tearing down a session with an in-flight SQL run results in that run reaching `cancelled` and never executing against the removed schema, verified end-to-end.
- **SC-007**: When the queue backend is unavailable, an enqueue-required SQL submission fails within 2 seconds with a clear service-unavailable outcome and creates no orphaned run record.

## Assumptions

- The Worker Queue Foundation (Done) provides the shared enqueue, per-job queue, status store, ownership checks, dead-letter path, session-teardown cancellation, and shared `job status` endpoint that this feature consumes; SQL Execution Queue adds a new `sql-execution` job type and its own queue rather than inventing new infrastructure.
- The existing Experiment Runner execution logic (session/dataset readiness checks, sandbox validation, sandboxed execution, metrics enrichment) is reused inside the SQL-run worker — mirroring how dataset reset reuses its execution service — so behavior stays centralized and consistent.
- Rate limiting is applied at the enqueue boundary (before a job is created) using the existing per-user SQL-run limits; the worker does not re-charge quota on execution or retry.
- Per-session in-flight de-duplication mirrors the benchmark inflight-limit pattern and defaults to 1 concurrent SQL run per session; the behavior on duplicate is **reject** (not replace).
- Completed run results (rows + metrics) are embedded in the shared job-status result payload and retrieved by run identifier via polling; large result sets are bounded by the existing sandbox row cap and reported as truncated when exceeded.
- The synchronous fast-path is out of scope for this feature (deferred): the queue-only path is fully correct and the fast-path can be added later without rework, consistent with the constitution's YAGNI / measure-before-optimize principles.
- Real-time streaming of run progress is out of scope; learners poll status. Live streaming remains owned by the Realtime Progress feature.
- SQL-run status/result retention reuses the existing configurable job-status retention window.

## Dependencies

- **Experiment Runner** (Done): Provides the SQL validation, sandboxed execution, and metrics enrichment logic reused by the SQL-run worker; its current synchronous run endpoint is the behavior to preserve (and migrate).
- **Worker Queue Foundation** (Done): Provides the shared queue/worker/retry/dead-letter primitives, shared job status endpoint, ownership model, and session-teardown cancellation.
- **SQL Sandbox & Resource Limits** (Done): Provides parameterized-only validation, blocked-statement rules, per-query timeout, and resource caps enforced for queued runs.
- **Experiment Isolation** (Done): Provides session identity used for per-session in-flight limits and for cancelling in-flight runs on session teardown.
- **Per-User Rate Limit** (Done): Provides the SQL-run quota enforced at the enqueue boundary.
- **Metrics Pipeline** (Done): Provides backend-owned metric computation and history used to deliver run metrics/results.

## Out of Scope

- Optional feature-flagged synchronous fast-path for eligible runs when the queue is idle — deferred to a later enhancement; this feature ships queue-only.
- Real-time progress streaming (SSE/WebSocket) for SQL runs — owned by the Realtime Progress feature.
- A learner-facing cancel API for individual SQL runs (cancellation occurs via session teardown / internal lifecycle only).
- Benchmark execution (already async via its own queue) and dataset reset (already async) — unchanged by this feature.
- Any change to the sandbox rule set, rate-limit tiers, or isolation model beyond consuming them.
- An admin HTTP API or learner UI for inspecting dead-letter records (logs + metrics only, per the foundation).
- Frontend lab UI wiring (SQL editor run/poll UX) — owned by Lab Shell and the Database Track lab features.
- Multi-statement transactional scripting semantics beyond what the current sandbox allows.
