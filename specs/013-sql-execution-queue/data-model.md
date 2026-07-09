# Data Model: SQL Execution Queue

**Feature**: 013-sql-execution-queue

This feature adds one `JobType` value and one typed queue body. It reuses the foundation's `BackgroundJob`, `JobStatus`, `JobFailureReason`, and `JobQueuePayload` unchanged (see `specs/012-worker-queue-foundation/data-model.md`).

## New / extended entities

### JobType (extend enum)

| Value | Queue name (default) | Handler |
| ----- | -------------------- | ------- |
| `benchmark` | `benchmark-jobs` | Existing k6 executor path |
| `dataset-reset` | `dataset-reset-jobs` | Teardown + seed reset path |
| **`sql-execution`** | **`sql-execution-jobs`** | **Reuses `RunExperimentSqlUseCase`** |

### SqlExecutionJobBody (new — BullMQ payload `body`)

Minimal execution payload; job status/result live in `JobStore`.

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `sql` | string | yes | Learner SQL statement (parameterized) |
| `parameters` | unknown[] | no | Positional query parameters |
| `dataset` | `{ family, tier, version? }` | yes | Dataset identity to resolve metadata |
| `context` | `{ requestId?, trackSlug?, labSlug?, userId? }` | no | Run context for logging/metrics |

Wrapped by the shared `JobQueuePayload`: `{ jobId, jobType: "sql-execution", sessionId, userId, body: SqlExecutionJobBody }`.

### BackgroundJob (reused — SQL-specific field usage)

| Field | SQL-execution usage |
| ----- | ------------------- |
| `jobType` | `sql-execution` |
| `sessionId` | Owning experiment session (required; used for inflight dedup + teardown cancel) |
| `userId` | Authenticated learner when present (ownership) |
| `payloadSummary` (on enqueue) | Non-sensitive summary: `{ statementKind, datasetFamily, datasetTier }` |
| `payloadSummary.executionResult` (on completion) | The enriched `ExperimentRunResult` (rows + metrics, row-cap bounded) — **the embedded result learners read** |
| `failureReason` | `VALIDATION_ERROR` \| `SESSION_UNAVAILABLE` \| `TIMEOUT` \| `EXECUTION_ERROR` \| `STORAGE_ERROR` \| `QUEUE_UNAVAILABLE` \| `RATE_LIMITED` |
| `attemptCount` / `maxAttempts` | From `sqlExecution.maxAttempts` (default 2) |

### ExperimentRunResult (reused, from `src/shared/experiment/`)

Unchanged. Produced by `RunExperimentSqlUseCase`; carries `rows`, metrics (Metric Contract), `runId`, and `truncated`. Embedded in `payloadSummary.executionResult` on completion. Row count bounded by the sandbox row cap.

## Configuration (new `sqlExecution` block)

| Key | Env | Default | Notes |
| --- | --- | ------- | ----- |
| `sqlExecution.queueName` | `SQL_EXECUTION_QUEUE_NAME` | `sql-execution-jobs` | Dedicated queue |
| `sqlExecution.workerConcurrency` | `SQL_EXECUTION_WORKER_CONCURRENCY` | aligned to playground pool (e.g. `5`) | Max simultaneous executing runs |
| `sqlExecution.jobTimeoutSeconds` | `SQL_EXECUTION_JOB_TIMEOUT_SECONDS` | `60` | BullMQ `lockDuration`; > sandbox query timeout |
| `sqlExecution.maxAttempts` | `SQL_EXECUTION_MAX_ATTEMPTS` | `2` | Retry only transient failures |
| `sqlExecution.backoffMs` | `SQL_EXECUTION_BACKOFF_MS` | `1000` | Fixed backoff |
| `sqlExecution.maxInflightPerSession` | `SQL_EXECUTION_MAX_INFLIGHT_PER_SESSION` | `1` | Reject duplicates over this |

## Relationships

```text
ExperimentSession 1──* BackgroundJob(sql-execution)
User 1──* BackgroundJob(sql-execution)
BackgroundJob(sql-execution) ──(on completion)──▶ payloadSummary.executionResult (ExperimentRunResult)
BackgroundJob(sql-execution) ──(on dead letter)──▶ logs/metrics (operator)
```

## State transitions

```text
queued → running → completed        (result embedded on completion)
queued → running → failed           (TIMEOUT / EXECUTION_ERROR; may dead-letter after maxAttempts)
queued → failed                     (non-retryable VALIDATION_ERROR / SESSION_UNAVAILABLE at start)
queued → cancelled                  (session teardown before start)
running → cancelled                 (session teardown mid-flight)
```

Invalid: `completed` → any; `cancelled` → `running`.

## Validation rules

- Enqueue MUST validate SQL via `ValidateSqlStatementService` before creating a job; validation failures return `400 VALIDATION_ERROR` and create no job (non-retryable).
- Enqueue MUST require a `READY`, non-expired session; otherwise `404 SESSION_UNAVAILABLE`, no job.
- Enqueue MUST reject when inflight `sql-execution` jobs for the session ≥ `maxInflightPerSession` → `409 SQL_RUN_INFLIGHT_LIMIT`, no job.
- Enqueue MUST charge `SQL_RUN` rate limit before job creation → over limit `429 RATE_LIMITED`, no job.
- On queue-add failure after the store write, delete the job row (no half-created job) → `503 QUEUE_UNAVAILABLE`.
- Worker MUST skip execution if the job is already `CANCELLED`.
- Worker MUST NOT re-charge rate limit (pre-authorized at enqueue).
- Completed result MUST be row-cap bounded; when truncated, `ExperimentRunResult.truncated = true`.
- Status read requires matching `userId` or `sessionId` ownership (foundation rule).
