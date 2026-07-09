# Research: SQL Execution Queue

**Feature**: 013-sql-execution-queue | **Date**: 2026-07-09

All spec clarifications were resolved in the spec (Session 2026-07-09). No `NEEDS CLARIFICATION` markers remain. This file records the design decisions that shape the plan.

## Decision 1: Reuse the Worker Queue Foundation with a dedicated queue

**Decision**: Add `JobType.SQL_EXECUTION` and a dedicated `sql-execution-jobs` BullMQ queue, reusing `EnqueueJobService`, `JobStore`, `JobQueueProducer`, `DeadLetterLogger`, and the shared `GET /jobs/:jobId` status endpoint.

**Rationale**: Foundation (012, Done) is production-ready for a third job type; `research.md` of 012 already earmarks `sql-execution` as a separate queue. A separate queue isolates interactive SQL concurrency from k6 benchmark load and dataset-reset, so SQL concurrency can be tuned to the playground connection pool independently (FR-002, FR-008, SC-002).

**Alternatives considered**:
- Reuse the benchmark queue: couples interactive latency-sensitive runs with heavy load tests.
- Build a bespoke queue outside the foundation: duplicates enqueue/status/retry/dead-letter and contradicts Simplicity.

## Decision 2: Reuse `RunExperimentSqlUseCase` as the execution engine

**Decision**: The worker processor calls the existing `RunExperimentSqlUseCase.execute()` (session/dataset readiness → `ValidateSqlStatementService` → `ExecuteSandboxedSqlUseCase` → `MetricsEnrichmentService`) rather than re-implementing SQL execution. Mirrors how the dataset-reset worker reuses `ExecuteDatasetResetService`.

**Rationale**: Guarantees queued runs produce results/metrics identical to the synchronous path (SC-004), keeps sandbox/timeout/row-cap enforcement centralized (FR-003, FR-010, FR-011), and avoids divergent SQL logic.

**Alternatives considered**:
- Duplicate execution logic in the worker: violates DRY and risks parity drift.

## Decision 3: Async endpoint added; sync use case retained as internal engine

**Decision**: Add `POST /experiments/sql/runs` (async, `202 { jobId, status: "queued" }`) for interactive learner runs. Keep the existing synchronous `POST /experiments/sql/run` / `RunExperimentSqlUseCase` as the internal engine used by (a) the SQL worker and (b) the benchmark internal load path.

**Rationale**: k6 benchmarks require a synchronous execution target to measure query latency — that path IS the load test, so it must stay synchronous. Interactive learner execution is the blocking path this feature removes (FR-001). A new route avoids a breaking change to the sync response contract that benchmark internals depend on.

**Alternatives considered**:
- Convert the single existing route to async: breaks the benchmark internal execution target and the sync response shape.
- One route with a mode flag: ambiguous contract, harder tests.

## Decision 4: Result delivery embedded in job status

**Decision**: On completion the worker stores the enriched `ExperimentRunResult` (rows + metrics, bounded by the sandbox row cap) in the job's `payloadSummary` (e.g. `payloadSummary.executionResult`). Learners poll `GET /jobs/:jobId` and read the result from the completed status — no separate result endpoint (spec clarification: embed).

**Rationale**: Single poll surface consistent with the foundation; mirrors the benchmark storing `k6Summary` in `payloadSummary`. Requires no change to the shared `GetJobStatusResult` contract (`payloadSummary?: Record<string, unknown>` already exists). Results are ownership-guarded by the existing status endpoint rules (FR-006, FR-007).

**Alternatives considered**:
- Separate fetch by run id from metrics history: rejected in clarification; adds a second surface.
- New dedicated result endpoint: unnecessary given the shared status payload.

**Constraint surfaced**: The sandbox row cap is currently declared but not enforced in `ExecuteSandboxedSqlUseCase` (always `truncated: false`). Because results now live in the status snapshot (Redis, TTL-bounded), the row cap MUST be enforced so a huge result set cannot bloat the store (FR-018). This is captured as an implementation task.

## Decision 5: Per-session in-flight de-duplication = reject

**Decision**: Before enqueue, `EnqueueSqlRunUseCase` calls `jobStore.countInflightBySession(sessionId, JobType.SQL_EXECUTION)`; if ≥ `sqlExecution.maxInflightPerSession` (default 1) it rejects with `409 SQL_RUN_INFLIGHT_LIMIT`. Mirrors `EnqueueBenchmarkUseCase`'s `BENCHMARK_INFLIGHT_LIMIT`.

**Rationale**: Prevents self-inflicted queue flooding and keeps per-learner behavior predictable (FR-009, SC-003); reuses an existing, tested pattern (spec clarification: reject).

**Alternatives considered**:
- Replace/cancel existing in-flight run: rejected in clarification (last-write-wins is surprising for query iteration and complicates cancellation semantics).
- Allow N>1: unnecessary for interactive single-user iteration.

## Decision 6: Rate limit at the enqueue boundary (charge once)

**Decision**: Charge `RateLimitOperation.SQL_RUN` in `EnqueueSqlRunUseCase` before creating the job (FR-014). The worker invokes `RunExperimentSqlUseCase` with an internal pre-authorized flag so it does **not** re-charge quota on execution or retry.

**Rationale**: Rate limit protects capacity at admission; charging again on execution/retry would double-count and penalize learners for transient retries. `RunExperimentSqlUseCase` already skips rate limit for `context.benchmarkInternal`; generalize that to a pre-authorized/internal invocation flag.

**Alternatives considered**:
- Charge at worker execution: exposes an unbounded enqueue surface and double-charges on retry.

## Decision 7: Timeout, cancellation, retry semantics

**Decision**: Per-query timeout stays enforced by the sandbox PG `statement_timeout` (default 30s) → mapped to `failed` / `TIMEOUT` (FR-011). BullMQ `lockDuration` (job-level timeout, config `sqlExecution.jobTimeoutSeconds`) is set comfortably above the query timeout. Sandbox validation failures are non-retryable (`VALIDATION_ERROR`). Only transient infrastructure failures retry (config `sqlExecution.maxAttempts`, default 2); exhaustion → dead-letter log/metric. The processor checks `CANCELLED` before executing (session teardown already cancels via `CancelSessionJobsUseCase`), so no new cancel wiring is needed (FR-012, FR-016).

**Rationale**: Reuses foundation retry/dead-letter and session-teardown cancellation; keeps sandbox as the single timeout authority (FR-010, FR-011, SC-005, SC-006).

**Alternatives considered**:
- Retry validation failures: wasteful and non-deterministic — excluded.
- New per-run cancel endpoint: out of scope (foundation cancels on teardown).

## Decision 8: Worker concurrency aligned to playground pool

**Decision**: `sqlExecution.workerConcurrency` (env `SQL_EXECUTION_WORKER_CONCURRENCY`) defaults to a value aligned with the playground connection-pool capacity; queued runs wait when the limit is reached (FR-008, SC-002). Queue depth / wait-time metrics are emitted for the SQL queue (FR-015).

**Rationale**: Bounding concurrency to pool capacity is the core protection this feature provides; excess load queues instead of exhausting connections.

**Alternatives considered**:
- Unbounded worker concurrency: defeats the purpose (pool exhaustion).
