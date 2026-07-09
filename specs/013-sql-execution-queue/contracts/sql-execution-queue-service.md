# API Contract: SQL Execution Queue

**Feature**: 013-sql-execution-queue | **Module**: `ExperimentRunnerModule` | **Base path**: `/experiments/sql`

All responses use the standard API envelope: `{ success, data, meta, error }`. Global prefix `/api/v1`.

This feature adds the **async enqueue** route below. Status polling reuses the shared `GET /jobs/:jobId` from the Worker Queue Foundation (012). The synchronous `POST /experiments/sql/run` is retained as the internal benchmark/worker execution engine and is not the learner-facing interactive path.

---

## POST /experiments/sql/runs

**Purpose**: Enqueue an interactive SQL run for asynchronous execution. Returns immediately with a job reference.

### Request body

```typescript
interface EnqueueSqlRunDto {
  sql: string;                        // required, parameterized
  parameters?: unknown[];             // positional params
  sessionId: string;                  // required: READY experiment session
  dataset: {
    family: string;                   // e.g. "commerce"
    tier: "100k" | "1m" | "10m";
    version?: string;                 // defaults to active version
  };
  context?: {
    trackSlug?: string;
    labSlug?: string;
  };
}
```

### Response (success): `202 Accepted`

```typescript
interface EnqueueSqlRunResult {
  jobId: string;
  jobType: "sql-execution";
  status: "queued";
  createdAt: string;
}
```

### Errors (enqueue)

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `VALIDATION_ERROR` | 400 | Empty/blocked/non-parameterized SQL, or invalid dataset identity |
| `SESSION_UNAVAILABLE` | 404 | Missing / expired / not-`READY` session |
| `DATASET_NOT_READY` | 422 | Dataset not prepared for the session |
| `SQL_RUN_INFLIGHT_LIMIT` | 409 | Session already has an in-flight SQL run (default max 1) |
| `RATE_LIMITED` | 429 | SQL-run quota exceeded (retry-after guidance) |
| `QUEUE_UNAVAILABLE` | 503 | Queue/Redis unavailable — no job created |

---

## GET /jobs/:jobId (shared — foundation)

**Purpose**: Poll lifecycle status and retrieve the completed result for an SQL run owned by the caller.

### Response (success): `200 OK`

```typescript
interface GetJobStatusResult {
  jobId: string;
  jobType: "sql-execution";           // (union also includes benchmark | dataset-reset)
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  attemptCount: number;
  maxAttempts: number;
  failureReason?:
    | "VALIDATION_ERROR"
    | "SESSION_UNAVAILABLE"
    | "TIMEOUT"
    | "EXECUTION_ERROR"
    | "STORAGE_ERROR"
    | "QUEUE_UNAVAILABLE";
  failureMessage?: string;            // learner-safe, educational
  payloadSummary?: {
    statementKind?: string;
    datasetFamily?: string;
    datasetTier?: string;
    // present when status === "completed":
    executionResult?: ExperimentRunResult; // rows + metrics (row-cap bounded, truncated flag)
  };
}
```

### Ownership & errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `NOT_FOUND` | 404 | Unknown jobId |
| `FORBIDDEN` | 403 | Job owned by another user/session |
| `UNAUTHORIZED` | 401 | Missing/invalid auth when required |

`ExperimentRunResult` is the existing shared result contract (rows, Metric Contract metrics, `runId`, `truncated`).

---

## Internal: cancel on session teardown (reused — foundation)

No new HTTP surface. `TeardownExperimentSessionUseCase` already invokes `CancelSessionJobsUseCase({ sessionId, reason: "SESSION_TEARDOWN" })`, which cancels in-flight `sql-execution` jobs for that session (marks `cancelled`, removes queued BullMQ jobs). The SQL worker skips execution for `cancelled` jobs.

---

## Observability events (non-HTTP)

Reuses foundation events tagged with `jobType: "sql-execution"`: `job_enqueued`, `job_started`, `job_completed`, `job_failed`, `job_retry`, `job_dead_lettered`, `job_cancelled`. Additionally emit SQL-queue depth and wait-time metrics (FR-015). Dead-letter surface is structured logs/metrics only (no admin API).
