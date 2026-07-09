# Tasks: SQL Execution Queue

**Input**: Design documents from `/specs/013-sql-execution-queue/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (constitution requires unit + integration).

**Organization**: Tasks grouped by user story for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Shared types, config, and module wiring for the new `sql-execution` job type

- [x] T001 Add `SQL_EXECUTION = 'sql-execution'` to `src/shared/jobs/job-type.enum.ts`; add `SqlExecutionJobBody` in `src/shared/jobs/sql-execution-job-body.ts` and export both from `src/shared/jobs/index.ts`
- [x] T002 [P] Add `sqlExecution.*` config block in `src/config/configuration.ts` (`queueName`, `workerConcurrency`, `jobTimeoutSeconds`, `maxAttempts`, `backoffMs`, `maxInflightPerSession`), validate keys in `src/config/env.validation.ts`, and document them in `.env.example`
- [x] T003 Import `WorkerQueueModule` into `src/modules/experiment-runner/experiment-runner.module.ts` so enqueue can use `EnqueueJobService`/`JobStore`

---

## Phase 2: Foundational

**Purpose**: Queue registration + typed body — blocks all user stories

**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T004 Add the `sql-execution` case to `JobQueueProducer.resolveQueueConfig()` in `src/modules/worker-queue/infrastructure/job-queue.producer.ts` (queue name, `maxAttempts`, backoff from `sqlExecution.*`)
- [x] T005 [P] Unit test the new producer case in `src/modules/worker-queue/infrastructure/job-queue.producer.spec.ts` (correct queue name + retry options for `SQL_EXECUTION`)
- [x] T006 Add `sql-execution` to the `jobType` union of `GetJobStatusResult` in `src/shared/jobs/get-job-status-result.ts` (and any mapper) so the shared status endpoint returns SQL runs

**Checkpoint**: Foundation recognizes the new job type; enqueue/status plumbing ready

---

## Phase 3: User Story 1 — Interactive SQL Runs Without Blocking the API (P1) 🎯 MVP

**Goal**: Enqueue interactive SQL and return a run reference immediately; a worker executes it and embeds the result for polling

**Independent Test**: `POST /experiments/sql/runs` returns `202 { jobId, status: "queued" }` before execution; poll `GET /jobs/:jobId` to `completed` with rows + metrics in `payloadSummary.executionResult`

### Tests

- [x] T007 [P] [US1] Unit tests for `EnqueueSqlRunUseCase` (happy path: validate → enqueue → returns jobId/queued) in `src/modules/experiment-runner/application/enqueue-sql-run.usecase.spec.ts`
- [x] T008 [P] [US1] Unit tests for `SqlExecutionWorkerProcessor` happy path (reuse `RunExperimentSqlUseCase`, `markRunning` → `markCompleted` with embedded result) in `src/workers/sql-execution-worker.processor.spec.ts`

### Implementation

- [x] T009 [US1] Add `EnqueueSqlRunDto` in `src/modules/experiment-runner/dto/enqueue-sql-run.dto.ts` (`sql`, `parameters?`, `sessionId`, `dataset`, `context?`) with validation
- [x] T010 [US1] Implement `EnqueueSqlRunUseCase` in `src/modules/experiment-runner/application/enqueue-sql-run.usecase.ts`: validate SQL via `ValidateSqlStatementService`, require `READY` session, build `SqlExecutionJobBody` + `payloadSummary`, call `EnqueueJobService.enqueue({ jobType: SQL_EXECUTION, ... })`
- [x] T011 [US1] Add `POST /experiments/sql/runs` to `src/modules/experiment-runner/experiment-runner.controller.ts` returning `202` `EnqueueSqlRunResult`
- [x] T012 [US1] Add a pre-authorized/internal invocation flag to `RunExperimentSqlUseCase` (generalize existing `context.benchmarkInternal` skip) so worker execution does not re-charge rate limit
- [x] T013 [US1] Implement `SqlExecutionWorkerProcessor` in `src/workers/sql-execution-worker.processor.ts`: BullMQ `Worker` on `sqlExecution.queueName`, load job, `markRunning`, call `RunExperimentSqlUseCase` (pre-authorized), store enriched `ExperimentRunResult` in `payloadSummary.executionResult`, `markCompleted`
- [x] T014 [US1] Add `SqlExecutionWorkerModule` in `src/workers/sql-execution-worker.module.ts` and entry `src/sql-execution-worker.main.ts` (application context, shutdown hooks); add `dev:sql-execution-worker` + `start:sql-execution-worker` scripts to `package.json`

**Checkpoint**: End-to-end enqueue → worker execute → poll result works (MVP)

---

## Phase 4: User Story 2 — Bounded Concurrency Protects Playground Capacity (P1)

**Goal**: Worker concurrency is bounded to playground pool capacity; queue depth / wait-time observable

**Independent Test**: Submit more concurrent runs than `SQL_EXECUTION_WORKER_CONCURRENCY`; simultaneous executing queries never exceed the limit; queued runs drain

### Tests

- [x] T015 [P] [US2] Test that the worker is constructed with `concurrency = sqlExecution.workerConcurrency` and `lockDuration = jobTimeoutSeconds` in `src/workers/sql-execution-worker.processor.spec.ts`

### Implementation

- [x] T016 [US2] Wire `sqlExecution.workerConcurrency` and `lockDuration` from `sqlExecution.jobTimeoutSeconds` into the worker in `src/workers/sql-execution-worker.processor.ts`
- [x] T017 [US2] Emit SQL-queue depth and wait-time observability signals (enqueue→start latency) using the foundation observability path, tagged `jobType: sql-execution`

**Checkpoint**: Concurrency ceiling enforced; queue metrics available (SC-002)

---

## Phase 5: User Story 3 — Duplicate In-Flight Runs Are Prevented Per Session (P2)

**Goal**: Reject a second SQL run for a session that already has one in flight

**Independent Test**: Two back-to-back runs for one session → second returns `409 SQL_RUN_INFLIGHT_LIMIT`; after first terminal, new run accepted

### Tests

- [x] T018 [P] [US3] Unit test dedup in `enqueue-sql-run.usecase.spec.ts`: `countInflightBySession` ≥ limit → `SQL_RUN_INFLIGHT_LIMIT`; below limit → enqueues

### Implementation

- [x] T019 [US3] In `EnqueueSqlRunUseCase`, call `JobStore.countInflightBySession(sessionId, JobType.SQL_EXECUTION)` and reject with `409 SQL_RUN_INFLIGHT_LIMIT` when ≥ `sqlExecution.maxInflightPerSession` (default 1) before creating a job

**Checkpoint**: SC-003 verified

---

## Phase 6: User Story 4 — Timeouts and Cancellation Propagate to Queued Runs (P2)

**Goal**: Sandbox timeout/validation map to categorized failures; session teardown cancels in-flight runs; retry only transient failures

**Independent Test**: (a) run exceeding sandbox timeout → `failed`/`TIMEOUT`; (b) blocked statement → non-retryable `VALIDATION_ERROR`; (c) teardown session with in-flight run → `cancelled`

### Tests

- [x] T020 [P] [US4] Processor tests in `src/workers/sql-execution-worker.processor.spec.ts`: sandbox timeout → `failed`/`TIMEOUT`; cancelled job skipped; non-retryable validation not retried; transient error retried then dead-lettered

### Implementation

- [x] T021 [US4] In `SqlExecutionWorkerProcessor`, skip execution when job status is `CANCELLED`, and re-check session readiness → `SESSION_UNAVAILABLE` on missing/torn-down session
- [x] T022 [US4] Map sandbox `QUERY_TIMEOUT`/`57014` to `failureReason: TIMEOUT`, sandbox validation to non-retryable `VALIDATION_ERROR`; only transient/infrastructure errors retry per `sqlExecution.maxAttempts`, exhaustion → `DeadLetterLogger`
- [x] T023 [US4] Verify `CancelSessionJobsUseCase` (invoked from `TeardownExperimentSessionUseCase`) cancels `sql-execution` jobs; add coverage in `src/modules/experiment-isolation/application/teardown-experiment-session.usecase.spec.ts` (no new wiring expected — foundation is job-type agnostic)

**Checkpoint**: SC-005 and SC-006 verified

---

## Phase 7: Polish & Cross-Cutting

- [x] T024 [P] Enforce the sandbox row cap in `src/modules/sql-sandbox/application/execute-sandboxed-sql.usecase.ts` (bound returned rows, set `truncated: true` when exceeded) so embedded results cannot bloat the status store (FR-018)
- [x] T025 [P] Integration test in `test/integration/sql-execution-queue.integration-spec.ts` (enqueue → poll → completed result; queue-unavailable → `503` within 2s; result parity vs sync run)
- [x] T026 [P] Update `README.md` (worker script), `.env.example`, and `docs/product/BACKLOG.md` status for SQL Execution Queue; align `quickstart.md`
- [x] T027 Run unit + integration suites for touched modules and fix regressions

---

## Dependencies & Execution Order

```text
Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → Polish
```

- US1 is the MVP: enqueue endpoint + worker + embedded result + shared status poll
- US2 (concurrency/metrics), US3 (dedup), US4 (timeout/cancel/retry) each build on the US1 enqueue+worker
- Cancel-on-teardown (US4) reuses the foundation's session cancellation — no new API

### Parallel examples

- T002 ∥ T001 after enum sketched
- T005 ∥ T004; T007 ∥ T008 (different files)
- T024 ∥ T025 ∥ T026 in Polish (different files)

## Implementation Strategy

1. Complete Setup + Foundational (T001–T006)
2. Ship US1 (T007–T014) as the MVP async SQL run slice
3. Add bounded concurrency + metrics (US2)
4. Add per-session dedup (US3)
5. Add timeout/cancel/retry semantics (US4)
6. Polish: row-cap enforcement, integration tests, docs, backlog Done

## Notes

- [P] = different files, no blocking dependency
- Feature-development rule: implement **one task at a time** when running `/speckit-implement`
- The synchronous `POST /experiments/sql/run` is retained as the internal benchmark/worker execution engine — do not remove it
- Fast-path (sync when idle) is out of scope for this feature
