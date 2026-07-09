# API Contract: Worker Queue Foundation

**Feature**: 012-worker-queue-foundation | **Module**: `WorkerQueueModule` | **Base path**: `/jobs`

All responses use the standard API envelope: `{ success, data, meta, error }`.

Feature modules retain enqueue routes. This contract covers the **shared status** surface and documents **enqueue response shape changes** for dataset reset / benchmark migration.

---

## GET /jobs/:jobId

**Purpose**: Poll lifecycle status for any foundation-managed job owned by the caller.

### Path params

| Param | Type | Notes |
| ----- | ---- | ----- |
| `jobId` | UUID string | Job identifier from enqueue response |

### Response (success): `200 OK`

```typescript
interface GetJobStatusResult {
  jobId: string;
  jobType: "benchmark" | "dataset-reset";
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
  failureMessage?: string;
  payloadSummary?: Record<string, unknown>;
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `NOT_FOUND` | 404 | Unknown jobId |
| `FORBIDDEN` | 403 | Job exists but owned by another user |
| `UNAUTHORIZED` | 401 | Missing/invalid auth when required |

---

## Enqueue: Dataset Reset (feature-owned)

**Route**: existing dataset reset endpoint (e.g. `POST /datasets/reset`) — behavior change.

### Response (success): `202 Accepted`

```typescript
interface EnqueueDatasetResetResult {
  jobId: string;
  jobType: "dataset-reset";
  status: "queued";
  createdAt: string;
  family: string;
  version: string;
  tier: "100k" | "1m" | "10m";
}
```

### Errors (enqueue)

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `VALIDATION_ERROR` | 400 | Invalid dataset identity |
| `SESSION_UNAVAILABLE` | 404 | Missing/expired session |
| `RATE_LIMITED` | 429 | Reset quota exceeded |
| `QUEUE_UNAVAILABLE` | 503 | Queue/Redis unavailable |

**Deprecated**: Synchronous reset completion in the same request.  
**Deprecated**: Relying solely on `GET /datasets/reset/status` — prefer `GET /jobs/:jobId`. The old status route may thin-delegate or be removed in implementation tasks.

---

## Enqueue: Benchmark (feature-owned)

**Route**: `POST /benchmarks` — unchanged success shape preferred; implementation must use shared `JobQueueProducer` + `JobStore`.

### Status migration

| Before | After |
| ------ | ----- |
| `GET /benchmarks/:jobId` | Prefer `GET /jobs/:jobId`; old route may delegate for compatibility then be removed |

---

## Internal: Cancel session jobs

Not an HTTP API. Invoked from experiment session teardown:

```typescript
interface CancelSessionJobsInput {
  sessionId: string;
  reason?: "SESSION_TEARDOWN";
}
```

Effects: mark matching non-terminal jobs `cancelled`; remove or ignore queued BullMQ jobs for that session.

---

## Observability events (non-HTTP)

| Event | When |
| ----- | ---- |
| `job_enqueued` | After successful queue add |
| `job_started` | Worker begins processing |
| `job_completed` | Handler success |
| `job_failed` | Attempt failure |
| `job_retry` | Retry scheduled |
| `job_dead_lettered` | Retries exhausted |
| `job_cancelled` | Session teardown cancel |

Dead-letter MVP surface: these structured logs/metrics only (no admin list API).
