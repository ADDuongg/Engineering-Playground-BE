# Implementation Plan: SQL Execution Queue

**Branch**: `013-sql-execution-queue` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-sql-execution-queue/spec.md`

## Summary

Add a third foundation job type, `sql-execution`, so interactive learner SQL runs are enqueued onto a dedicated `sql-execution-jobs` BullMQ queue instead of executing synchronously in the HTTP handler. A new async enqueue endpoint (`POST /experiments/sql/runs`) validates the SQL, enforces per-session in-flight de-duplication (default 1, **reject** on duplicate) and the existing SQL-run rate limit at the enqueue boundary, then returns `202 { jobId, status: "queued" }`. A dedicated worker process reuses the existing `RunExperimentSqlUseCase` (session/dataset readiness → sandbox validation → sandboxed execution → metrics enrichment) so execution behavior is identical to today, and stores the completed `ExperimentRunResult` (rows + metrics, bounded by the sandbox row cap) in the job's `payloadSummary` so learners retrieve it by polling the shared `GET /jobs/:jobId`. Worker concurrency is bounded to align with playground pool capacity. Session teardown already cancels in-flight jobs via the foundation. The synchronous fast-path is **deferred** (out of scope). The existing synchronous `RunExperimentSqlUseCase` remains as the internal execution engine used by both the worker and the benchmark internal load path.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, BullMQ, ioredis (existing) — consumes `WorkerQueueModule` (`EnqueueJobService`, `JobStore`, `JobQueueProducer`, `DeadLetterLogger`), reuses `ExperimentRunnerModule` (`RunExperimentSqlUseCase`), `SqlSandboxModule` (`ValidateSqlStatementService`), `ExperimentIsolationModule` (session store), `RateLimitService`, `MetricsEnrichmentService`

**Storage**: Redis for the `sql-execution-jobs` queue and shared job-status snapshots (`jobs:status:{id}`, session index `jobs:session:{sessionId}`); no Platform DB migration (result embedded in job status snapshot, TTL-bounded)

**Testing**: Unit tests for `EnqueueSqlRunUseCase` (validation, inflight dedup, rate limit, queue-unavailable) and the worker processor (execute/reuse, timeout→failure, cancelled skip, dead-letter); integration test for enqueue → poll → completed result parity; parity check that queued result equals synchronous result for SELECT / EXPLAIN / index create-drop

**Target Platform**: NestJS API (`src/modules/experiment-runner/`) + new worker entry `src/sql-execution-worker.main.ts` with processor under `src/workers/`

**Project Type**: Backend web-service (NestJS monorepo module)

**Performance Goals**: Enqueue responds within 2s regardless of query duration (SC-001); queue-unavailable fails within 2s (SC-007); simultaneously executing queries never exceed configured worker concurrency (SC-002)

**Constraints**: Never run interactive SQL synchronously in the request handler (default path); enforce sandbox rules/timeout/row cap on queued runs identically to sync; charge rate limit once (at enqueue), never re-charge on worker execution/retry; fail closed with `QUEUE_UNAVAILABLE` when enqueue required and Redis/queue down; ownership enforced on shared status endpoint

**Scale/Scope**: Database Track MVP — adds `sql-execution` job type; benchmark and dataset-reset queues unchanged

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: New `JobType.SQL_EXECUTION` in `src/shared/jobs/`; reuses shared `BackgroundJob`, `JobQueuePayload`, `GetJobStatusResult`; SQL body/result reuse existing `ExperimentRunInput`/`ExperimentRunResult` in `src/shared/experiment/`
- [x] **Feature-first backend**: `ExperimentRunnerController` (enqueue only) → `EnqueueSqlRunUseCase` → `EnqueueJobService`/`JobStore`; worker → `SqlExecutionWorkerProcessor` → existing `RunExperimentSqlUseCase`. No forbidden deps (worker never imports controllers)
- [x] **TypeScript strict**: Typed `SqlExecutionJobBody`; no unjustified `any`
- [x] **Testing**: Unit + integration planned; result-parity and timeout/cancel covered
- [x] **Learning UX**: Categorized failures on status poll (`TIMEOUT`, `VALIDATION_ERROR`, `SESSION_UNAVAILABLE`); truncation-aware results; actionable `SQL_RUN_INFLIGHT_LIMIT` / `QUEUE_UNAVAILABLE`
- [x] **Platform vs Playground**: SQL executes only against the session's isolated playground schema; job metadata/result in Redis (TTL); no Platform DB coupling
- [x] **Simplicity**: Reuses the foundation and the existing execution use case; adds one queue + one worker + one enqueue endpoint. No new abstractions; fast-path deferred (YAGNI)

**Post-design note**: The existing synchronous `POST /experiments/sql/run` is retained as the **benchmark-internal / worker execution engine** (k6 load testing requires synchronous execution as its measurement target). Interactive learner runs move to the new async `POST /experiments/sql/runs`. Rate limiting moves to the enqueue boundary; the worker passes an internal pre-authorized flag so `RunExperimentSqlUseCase` does not re-charge quota. No constitution violations; no Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/013-sql-execution-queue/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sql-execution-queue-service.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── experiment-runner/
│       ├── experiment-runner.controller.ts          # + POST /experiments/sql/runs (async enqueue)
│       ├── experiment-runner.module.ts              # import WorkerQueueModule
│       ├── application/
│       │   ├── enqueue-sql-run.usecase.ts           # NEW: validate + dedup + rate-limit + enqueue
│       │   ├── enqueue-sql-run.usecase.spec.ts      # NEW
│       │   └── run-experiment-sql.usecase.ts        # reused as execution engine (skip re-charge when pre-authorized)
│       └── dto/
│           └── enqueue-sql-run.dto.ts               # NEW (reuses RunExperimentSqlDto shape)
├── workers/
│   ├── sql-execution-worker.module.ts               # NEW
│   └── sql-execution-worker.processor.ts            # NEW: reuse RunExperimentSqlUseCase → store result
├── shared/
│   └── jobs/
│       ├── job-type.enum.ts                         # + SQL_EXECUTION
│       └── sql-execution-job-body.ts                # NEW: typed queue body
├── config/
│   └── configuration.ts                             # + sqlExecution.* block
└── sql-execution-worker.main.ts                     # NEW entry + package.json script

test/
└── integration/
    └── sql-execution-queue.integration-spec.ts      # NEW
```

**Structure Decision**: Enqueue logic and the async endpoint live in the existing `ExperimentRunnerModule` (feature owns its enqueue route, per the foundation contract). The dedicated worker process/queue mirrors the benchmark and dataset-reset workers. The shared status surface (`GET /jobs/:jobId`) is reused unchanged — the SQL result rides in `payloadSummary` exactly as the benchmark's `k6Summary` does.

## Complexity Tracking

> No Constitution Check violations — this feature reuses the Worker Queue Foundation, the existing SQL execution use case, and the shared status endpoint. No new abstractions introduced; table intentionally empty.
