# Feature Specification: Worker Queue Foundation

**Feature Branch**: `012-worker-queue-foundation`

**Created**: 2026-07-09

**Status**: Spec Ready

**Input**: User description: "Establish shared background-job infrastructure for heavy async work so benchmarks, dataset resets, and future SQL execution jobs use common queue, worker, retry, and dead-letter primitives. UseCases must remain correct when the queue backend is unavailable for cache-only paths (ENGINEERING_GUIDE §14–15, BACKLOG Worker Queue Foundation)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-09

- Q: How should learners experience dataset reset once it uses the shared worker foundation? → A: Always enqueue; API returns `jobId` + `queued` immediately; learners poll for completion (same pattern as benchmarks). No sync fast-path for small tiers.
- Q: How should learners poll foundation-managed job status? → A: Shared status endpoint (`GET /jobs/:jobId`) for all foundation job types; enqueue remains on feature-owned routes (e.g. benchmarks, dataset reset).
- Q: How should jobs be partitioned across queues? → A: Separate queues per job type (`benchmark`, `dataset-reset`, …) with shared foundation libraries for enqueue, status, retry, and dead-letter; not one shared multi-type queue.
- Q: Is an explicit learner-facing cancel API in scope? → A: No learner cancel API in this feature; cancel queued/running jobs only via session teardown and related internal lifecycle events.
- Q: What is the MVP dead-letter inspection surface? → A: Structured logs + metrics only (job type, failure category, attempt count, job id); no admin HTTP API for dead-letter records in this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Heavy Work Leaves the Request Path (Priority: P1)

A learner triggers a heavy operation (for example starting a benchmark or resetting a dataset). The platform accepts the request quickly and schedules the work on a shared background-job foundation. The learner's lab UI stays responsive while the work runs elsewhere. Operators can rely on one consistent pattern for enqueueing, processing, and observing these jobs.

**Why this priority**: Without a shared foundation, each heavy feature invents its own queue wiring. That blocks SQL Execution Queue and makes dataset reset / benchmark behavior inconsistent under load.

**Independent Test**: Can be fully tested by submitting a supported heavy job type through the shared enqueue path and verifying the HTTP response returns before the job finishes, while a worker process completes the job.

**Acceptance Scenarios**:

1. **Given** a learner submits a supported heavy job, **When** the platform accepts it, **Then** the response returns a job reference without waiting for the work to finish.
2. **Given** a job is accepted, **When** a worker is available, **Then** the job is processed outside the HTTP request that accepted it.
3. **Given** multiple job types use the foundation, **When** operators inspect job handling, **Then** enqueue, lifecycle, and failure handling follow the same shared conventions.
4. **Given** a learner has submitted any foundation-managed job, **When** they poll the shared job status endpoint with that job identifier, **Then** they receive the current lifecycle state for that job.

---

### User Story 2 - Failed Jobs Retry Then Land in a Dead Letter Path (Priority: P1)

Platform operators need confidence that transient failures (temporary queue or target unavailability) do not permanently lose learner work, and that permanently failing jobs are visible for investigation. The foundation retries according to policy, then moves exhausted jobs into a dead-letter path with enough context to diagnose the failure.

**Why this priority**: Learning labs depend on reliable async work. Silent job loss or infinite retries undermine trust and can exhaust shared resources.

**Independent Test**: Can be tested by forcing a transient failure (job succeeds after retry) and a permanent failure (job exhausts retries and appears in the dead-letter path with a categorized reason).

**Acceptance Scenarios**:

1. **Given** a job fails with a retryable error, **When** retries remain, **Then** the foundation re-attempts the job according to configured retry policy.
2. **Given** a job exhausts its retry budget, **When** the final attempt fails, **Then** the job is recorded in a dead-letter path and is no longer actively retried.
3. **Given** a job is in the dead-letter path, **When** an operator inspects logs/metrics, **Then** they can see job type, job identifier, failure category, and attempt count (and owning session or learner context where available).
4. **Given** a non-retryable validation or authorization failure, **When** the job is rejected, **Then** it is not endlessly retried and the learner receives an actionable failure reason.

---

### User Story 3 - Dataset Reset and Benchmarks Share the Foundation (Priority: P1)

Learners already use benchmarks asynchronously. Dataset reset is also heavy work that must not block the API. Both flows route through the shared worker foundation so operators run one worker model and learners get consistent job status behavior.

**Why this priority**: Backlog deliverables explicitly require routing benchmark and dataset reset through workers. Completing this story unblocks SQL Execution Queue and reduces duplicated queue code.

**Independent Test**: Can be tested by enqueueing one benchmark job and one dataset-reset job through the shared foundation and verifying both complete via workers with queryable lifecycle status.

**Acceptance Scenarios**:

1. **Given** a learner enqueues a benchmark, **When** the job is accepted, **Then** it uses the shared foundation primitives (not a one-off path that bypasses retry/dead-letter conventions).
2. **Given** a learner requests a dataset reset (any tier), **When** the reset is accepted, **Then** the API returns a job identifier with initial status queued immediately and does not wait for reset completion; the learner polls job status until completed or failed.
3. **Given** either job type fails after retries, **When** the foundation finalizes failure, **Then** the learner-visible status reflects a categorized failure rather than an opaque timeout.

---

### User Story 4 - Learning Features Survive Queue Outages for Cache-Only Paths (Priority: P2)

When the queue backend is temporarily unavailable, features that only use it for caching or optional acceleration must continue to work. Features that require the queue for heavy work must fail clearly rather than hanging or corrupting state. UseCases must not embed queue-vendor assumptions that force business-logic rewrites when the queue is down.

**Why this priority**: ENGINEERING_GUIDE requires that removing Redis/cache infrastructure must not break UseCase correctness for cache-only paths. Learners should still run core experiments when async infrastructure is degraded, with clear messaging for queue-dependent actions.

**Independent Test**: Can be tested by simulating queue unavailability and verifying (a) a cache-only dependent flow still succeeds and (b) a queue-required heavy job submission fails fast with a service-unavailable style message.

**Acceptance Scenarios**:

1. **Given** the queue backend is unavailable, **When** a learner performs an operation that only uses cache optionally, **Then** the operation still completes successfully without requiring UseCase changes.
2. **Given** the queue backend is unavailable, **When** a learner submits a queue-required heavy job, **Then** the request is rejected quickly with a clear service-unavailable message and no ambiguous half-created job.
3. **Given** the queue recovers, **When** learners submit new heavy jobs, **Then** enqueue and processing resume without manual data repair for new jobs.

---

### Edge Cases

- What happens when a worker crashes mid-job? The job is retried according to policy (or dead-lettered if attempts are exhausted); no orphaned “running forever” state without a timeout bound.
- What happens when two workers claim the same job? Exactly-once active processing is guaranteed by the foundation’s lease/lock semantics; duplicate side effects are prevented or made idempotent at the job-handler boundary.
- What happens when job payload is malformed? The job fails as non-retryable with a validation category and does not poison the worker loop.
- What happens when dead-letter storage itself fails? The job status is still marked failed with a storage/infrastructure category; operators receive an observability signal.
- What happens when a learner wants to cancel a queued job? There is no learner-facing cancel endpoint in this feature; cancellation occurs when the experiment session is torn down (or equivalent internal lifecycle), moving the job to a cancelled/terminal state so it is not executed.
- What happens when queue depth grows beyond healthy bounds? New enqueue attempts may be rejected or delayed per backpressure policy with clear learner feedback; existing in-flight jobs continue under concurrency limits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a shared background-job foundation used by heavy async features (at minimum benchmark execution and dataset reset).
- **FR-001a**: System MUST use a separate queue per job type while sharing common enqueue, status, retry, and dead-letter primitives across those queues.
- **FR-002**: System MUST accept heavy jobs asynchronously and MUST NOT block the HTTP response until job execution completes.
- **FR-003**: System MUST support configurable worker concurrency and per-job timeout bounds (configurable per queue/job type).
- **FR-004**: System MUST support a configurable retry policy (maximum attempts and backoff behavior) for retryable failures.
- **FR-005**: System MUST move jobs that exhaust retries into a dead-letter path and MUST emit structured operator-facing logs and metrics including job type, failure category, attempt count, and job identifier (no admin HTTP API for dead-letter inspection in this feature).
- **FR-006**: System MUST expose a consistent job lifecycle for foundation-managed jobs: at minimum queued, running, completed, failed, and cancelled (cancelled is set by internal lifecycle such as session teardown — not by a learner cancel API in this feature).
- **FR-007**: System MUST expose a shared job status endpoint for all foundation-managed jobs and MUST allow learners to retrieve status only for their own jobs (MUST prevent access to other users’ jobs).
- **FR-007a**: Feature modules MUST own their enqueue endpoints; status polling MUST use the shared job status surface rather than duplicating per-feature status APIs for foundation jobs.
- **FR-008**: System MUST route dataset reset through the worker foundation for all tiers (not synchronous request-handler execution) and MUST return a job identifier with initial status queued without waiting for reset completion.
- **FR-008a**: System MUST allow learners to poll dataset-reset job status via the shared job status endpoint until completed or failed.
- **FR-009**: System MUST route benchmark execution through the shared foundation conventions (generalizing or adapting the existing benchmark-specific path without regressing lifecycle behavior).
- **FR-010**: System MUST fail fast with a clear service-unavailable outcome when enqueue is required and the queue backend is unavailable.
- **FR-011**: System MUST keep UseCases correct for cache-only paths when the queue backend is unavailable (no hard dependency on queue availability for non-queue features).
- **FR-012**: System MUST emit observability signals for enqueue, start, completion, failure, retry, and dead-letter events.
- **FR-013**: System MUST bound in-flight work so runaway jobs cannot unbounded-exhaust shared playground capacity.
- **FR-014**: Job handlers MUST be idempotent or safely re-runnable for the retry cases they declare as retryable.

### Key Entities

- **Background Job**: A unit of heavy work with identifier, type, owner (learner/session), payload reference, lifecycle status, timestamps, attempt count, and optional failure reason.
- **Job Type**: A named category of work (e.g., benchmark, dataset-reset) that selects the handler and retry/timeout policy defaults.
- **Retry Policy**: Rules for how many times and how long to wait before re-attempting a failed job.
- **Dead Letter Record**: A terminal failed job retained for operator inspection after retries are exhausted.
- **Worker Process**: An out-of-request process that claims and executes jobs according to concurrency limits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of heavy-job submission responses for supported job types return within 2 seconds under normal load, regardless of job duration (verified by acceptance tests).
- **SC-002**: Dataset reset and benchmark jobs both complete successfully via the shared foundation in end-to-end verification without synchronous handler execution.
- **SC-003**: 100% of jobs that exhaust retries appear in the dead-letter path with a categorized failure reason (verified with a controlled permanent-failure test).
- **SC-004**: When the queue backend is unavailable, at least one cache-only or non-queue learning operation still succeeds, while queue-required enqueue fails within 2 seconds with a clear unavailable outcome.
- **SC-005**: Under configured max concurrency, workers never process more concurrent jobs than the configured limit (verified in concurrency tests).

## Assumptions

- Benchmark Runner already demonstrates a working async benchmark path; this feature generalizes shared primitives and brings dataset reset onto the same foundation rather than inventing a second unrelated queue stack.
- Dataset reset becomes fully asynchronous for all tiers (no sync fast-path); existing sync reset behavior is replaced by enqueue + poll.
- Job status for foundation-managed jobs is polled via a shared status endpoint; feature modules keep enqueue routes and do not require separate status APIs for those jobs (existing benchmark-specific status route may be removed or redirected during migration).
- Queue topology is one queue per job type with shared libraries (not a single multi-type queue), so future SQL Execution Queue can add its own queue without sharing a worker pool with benchmarks.
- SQL Execution Queue remains a separate feature that will consume this foundation after it exists; interactive SQL may stay synchronous until that feature is implemented.
- “Cache-only paths” means features that use Redis (or similar) only for caching/rate-limit acceleration where business outcomes can proceed without the queue — not that all Redis usage is optional.
- Dead-letter inspection for MVP is structured logs and metrics only; no admin HTTP API or learner-facing dead-letter UI.
- Learner-facing cancel API is out of scope; internal cancel-on-session-teardown (and equivalent lifecycle hooks) remains in scope so orphaned jobs do not run after session end.
- Realtime progress streaming for long jobs remains owned by the Realtime Progress feature.

## Dependencies

- **Benchmark Runner** (Done): Provides the first production consumer of async workers and lifecycle patterns to generalize.
- **Dataset Reset** (Done): Existing reset behavior must be moved onto the worker foundation without changing learner-facing reset semantics beyond becoming asynchronous where required.
- **Authentication** / **Per-User Rate Limit** (Done): Job ownership and fair-use limits continue to apply at enqueue boundaries.

## Out of Scope

- Full interactive SQL Execution Queue (dedicated feature that depends on this foundation).
- Realtime progress streaming / SSE for job progress (Realtime Progress feature).
- Benchmark metric aggregation and history charts (Benchmark Metrics feature).
- Multi-region queue replication or cross-cluster failover.
- Learner-facing dead-letter browser UI.
- Admin HTTP API for listing or inspecting dead-letter records.
- Learner-facing job cancel endpoint (`POST /jobs/:jobId/cancel` or equivalent).
- Replacing rate limiting or experiment isolation — those remain separate features.
