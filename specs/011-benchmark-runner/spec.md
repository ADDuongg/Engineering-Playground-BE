# Feature Specification: Benchmark Runner

**Feature Branch**: `011-benchmark-runner`

**Created**: 2026-07-08

**Status**: Spec Ready

**Input**: User description: "Schedule and execute benchmarks asynchronously without blocking API requests. Queue benchmark jobs via worker path, support configurable RPS tiers (100 / 500 / 1000 / 5000) and durations, track benchmark lifecycle (queued → running → completed → failed), and isolate benchmark load from platform stability (ROADMAP §Benchmark, PRD §13)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a Benchmark Without Blocking the Lab (Priority: P1)

A learner in a Database Track lab configures a load test (target request rate and duration) against their current experiment query or endpoint. They submit the benchmark and immediately return to the lab interface while the platform runs the test in the background. The API responds quickly with a job reference so the learner knows the benchmark was accepted.

**Why this priority**: Benchmark labs teach performance under load. If the HTTP request blocks until the test finishes, the lab UI freezes and the platform cannot serve other learners. Non-blocking submission is the foundational behavior this feature must guarantee.

**Independent Test**: Can be fully tested by submitting a benchmark with a multi-second duration and verifying the API returns within a short, fixed time budget while the benchmark continues executing separately.

**Acceptance Scenarios**:

1. **Given** a learner has an active experiment session with a valid target query, **When** they submit a benchmark with a supported RPS tier and duration, **Then** the platform accepts the job and returns a benchmark job identifier without waiting for the test to finish.
2. **Given** a benchmark job is accepted, **When** the learner continues using the lab (e.g., viewing results or editing SQL), **Then** their session remains responsive and other platform users are not blocked by the running benchmark.
3. **Given** a learner submits a benchmark, **When** the API responds, **Then** the response includes enough information to check status later (job identifier and initial lifecycle state).
4. **Given** a benchmark is running, **When** the learner polls or subscribes for status, **Then** they can distinguish queued, running, completed, and failed states.

---

### User Story 2 - Configure Standard Load Profiles (Priority: P1)

A learner selects from predefined load profiles that match lab curriculum expectations: request-rate tiers (100, 500, 1000, 5000 requests per second) and duration options (10, 30, 60 seconds). The platform validates the combination before enqueueing so learners cannot accidentally start unsupported or unsafe profiles.

**Why this priority**: Consistent load tiers make labs comparable and reproducible. Learners should focus on query optimization, not tooling setup.

**Independent Test**: Can be tested by submitting each supported RPS and duration combination and verifying acceptance or clear rejection for unsupported values.

**Acceptance Scenarios**:

1. **Given** a learner selects a supported RPS tier and duration, **When** they submit the benchmark, **Then** the job is created with those parameters recorded on the job.
2. **Given** a learner selects an unsupported RPS value or duration, **When** they submit the benchmark, **Then** the request is rejected before any load test starts with an actionable validation message.
3. **Given** a lab defines a recommended profile for an exercise, **When** the learner uses that profile, **Then** the resulting job parameters match the lab's expected tier and duration.
4. **Given** platform operators adjust the allowed tier list via configuration, **When** learners submit benchmarks, **Then** only currently allowed tiers are accepted.

---

### User Story 3 - Track Benchmark Lifecycle (Priority: P1)

A learner needs visibility into what stage their benchmark is in. The platform tracks each job through a clear lifecycle: queued, running, completed, or failed. Transitions are recorded with timestamps so learners and support can understand delays or failures.

**Why this priority**: Long-running benchmarks require trust. Without lifecycle visibility, learners cannot tell whether to wait, retry, or fix their query.

**Independent Test**: Can be tested by driving a benchmark from submission through completion (or failure) and verifying each lifecycle transition is observable with consistent status values.

**Acceptance Scenarios**:

1. **Given** a newly submitted benchmark, **When** the job is persisted, **Then** its initial status is queued until a worker picks it up.
2. **Given** a worker begins executing a benchmark, **When** execution starts, **Then** the job status transitions to running and records a start timestamp.
3. **Given** a benchmark finishes successfully, **When** execution completes, **Then** the job status transitions to completed and records a completion timestamp.
4. **Given** a benchmark cannot complete (timeout, target error, infrastructure failure), **When** execution aborts, **Then** the job status transitions to failed with a learner-appropriate reason category.
5. **Given** a learner requests status for their own job, **When** the job exists, **Then** they receive the current lifecycle state and key timestamps.

---

### User Story 4 - Isolate Benchmark Load from Platform Stability (Priority: P2)

Platform operators need assurance that heavy load tests run against the learner's playground target without degrading core API availability. Benchmark execution is isolated from the request-handling path and bounded so runaway tests cannot exhaust shared resources.

**Why this priority**: Benchmarks intentionally generate load. Without isolation, one learner's lab exercise could impact authentication, browsing, or other learners' experiments.

**Independent Test**: Can be tested by running a high-tier benchmark concurrently with normal API traffic and verifying core endpoints remain within acceptable latency while the benchmark executes in isolation.

**Acceptance Scenarios**:

1. **Given** multiple benchmarks are queued, **When** workers process them, **Then** execution occurs outside the HTTP request path that accepted the job.
2. **Given** a benchmark targets a learner's experiment session, **When** load is applied, **Then** it is directed at the playground runtime context for that session, not the permanent platform database.
3. **Given** a benchmark exceeds configured resource or time bounds, **When** limits are hit, **Then** the job is terminated and marked failed without leaving orphaned load processes.
4. **Given** normal platform traffic during an active benchmark, **When** learners use non-benchmark features, **Then** error rates for those features remain within acceptable bounds under defined concurrency tests.

---

### Edge Cases

- What happens when a learner submits a benchmark without an active experiment session? The request is rejected before enqueueing with guidance to start or restore a lab session.
- What happens when the same learner submits multiple benchmarks in quick succession? Each submission creates a distinct job; concurrent jobs for the same session follow platform concurrency rules (reject or queue excess jobs with clear feedback).
- What happens when a benchmark is queued but the learner's session is torn down before execution starts? The job is cancelled or failed with a session-unavailable reason rather than executing against a missing target.
- What happens when the job queue is temporarily unavailable? The API rejects new benchmark submissions with a service-unavailable style message; no partial jobs are left in an ambiguous state.
- What happens when a benchmark completes but result storage fails? The job is marked failed with a storage error category; raw load-test output is not silently dropped without status update.
- What happens when a learner requests status for another user's job? Access is denied; job identifiers are not enumerable across users.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept benchmark job submissions asynchronously and MUST NOT block the HTTP response until the load test completes.
- **FR-002**: System MUST support configurable request-rate tiers of at minimum 100, 500, 1000, and 5000 requests per second.
- **FR-003**: System MUST support configurable benchmark durations of at minimum 10, 30, and 60 seconds.
- **FR-004**: System MUST validate RPS tier and duration before enqueueing a job and MUST reject unsupported combinations with actionable errors.
- **FR-005**: System MUST assign each accepted benchmark a unique job identifier returned to the learner.
- **FR-006**: System MUST track benchmark lifecycle states: queued, running, completed, and failed.
- **FR-007**: System MUST record timestamps for job creation and each lifecycle transition.
- **FR-008**: System MUST execute benchmarks through a background worker path separate from the API handler that accepted the submission.
- **FR-009**: System MUST scope benchmark targets to the learner's active experiment session and playground runtime context.
- **FR-010**: System MUST enforce per-job time and resource bounds so runaway benchmarks are terminated and marked failed.
- **FR-011**: System MUST allow a learner to retrieve the current status of their own benchmark jobs.
- **FR-012**: System MUST prevent learners from accessing or inferring other users' benchmark jobs.
- **FR-013**: System MUST integrate with existing per-user rate limits for benchmark enqueue operations where rate limiting is enabled.
- **FR-014**: System MUST emit observability events for benchmark lifecycle transitions suitable for operations monitoring.

### Key Entities

- **Benchmark Job**: A schedulable unit representing one load test — includes job identifier, owning learner or session, target reference, RPS tier, duration, lifecycle status, timestamps, and failure reason when applicable.
- **Benchmark Profile**: A validated combination of request-rate tier and duration allowed by platform configuration.
- **Benchmark Target**: The experiment-scoped subject under test (e.g., SQL query or session endpoint) resolved from the learner's active lab session.
- **Benchmark Lifecycle Event**: A recorded transition (queued, running, completed, failed) with timestamp for status tracking and observability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of benchmark submission API responses return within 2 seconds under normal load, regardless of selected duration (verified by acceptance tests).
- **SC-002**: Learners can start benchmarks at all four supported RPS tiers and three supported durations without manual infrastructure setup.
- **SC-003**: 100% of accepted jobs expose a queryable lifecycle state that progresses through queued and running before reaching completed or failed (verified for success and controlled failure paths).
- **SC-004**: When one learner runs a maximum-tier 60-second benchmark, concurrent learners complete standard SQL experiment requests with no more than a defined baseline increase in error rate (isolation verified in concurrency tests).
- **SC-005**: 100% of failed benchmarks return a categorized, learner-appropriate reason (validation, session unavailable, timeout, execution error, storage error) rather than an opaque failure.

## Assumptions

- Experiment Runner and Metrics Pipeline are available; benchmarks reuse experiment session context and will hand off raw results to Metrics Pipeline / Benchmark Metrics features for aggregation and history.
- Supported RPS tiers align with product backlog (100, 500, 1000, 5000); additional tiers such as 300 RPS from PRD may be added later via configuration without changing core lifecycle behavior.
- Benchmark submission requires an authenticated learner or valid experiment session consistent with other Database Track experiment operations.
- Per-User Rate Limit applies to benchmark enqueue as a distinct operation tier.
- Result persistence and chart-ready metrics are primarily owned by the separate Benchmark Metrics feature; this feature focuses on scheduling, execution, and lifecycle tracking with enough completion signal for downstream collection.
- Realtime progress streaming to the UI is out of scope for this feature and belongs to the Realtime Progress feature.

## Dependencies

- **Experiment Runner** (Done): Provides experiment session context and SQL execution path for benchmark targets.
- **Metrics Pipeline** (Done): Receives execution signals for downstream metric enrichment and storage.
- **Per-User Rate Limit** (Done): Enforces fair-use limits on benchmark enqueue operations.

## Out of Scope

- Aggregating latency percentiles, throughput charts, and benchmark history (Benchmark Metrics feature).
- Live progress streaming or partial metric preview during a run (Realtime Progress feature).
- General-purpose worker queue infrastructure shared with dataset reset and SQL execution queue (Worker Queue Foundation feature — this feature may introduce benchmark-specific queue usage that the foundation later generalizes).
- User-uploaded custom load scripts or arbitrary RPS values outside configured tiers.
- Benchmarking targets outside the learner's playground experiment session.
