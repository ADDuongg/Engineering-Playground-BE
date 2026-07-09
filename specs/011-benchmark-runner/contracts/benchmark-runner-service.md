# API Contract: Benchmark Runner

**Feature**: 011-benchmark-runner | **Module**: `BenchmarkRunnerModule` | **Base path**: `/benchmarks`

All responses use the standard API envelope: `{ success, data, meta, error }`.

---

## POST /benchmarks

**Purpose**: Enqueue a load benchmark for the learner's experiment session. Returns immediately with job identifier and initial status `queued`.

### Request body: `EnqueueBenchmarkDto`

```typescript
interface EnqueueBenchmarkDto {
  sessionId: string;
  profile: {
    rps: 100 | 500 | 1000 | 5000;
    durationSeconds: 10 | 30 | 60;
  };
  target: {
    sql: string;
    parameters?: unknown[];
    dataset: {
      family: string;
      tier: "100k" | "1m" | "10m";
      version?: string;
    };
  };
  context?: {
    trackSlug?: string;
    labSlug?: string;
  };
}
```

### Response (success): `202 Accepted`

```typescript
interface EnqueueBenchmarkResult {
  jobId: string;
  status: "queued";
  profile: {
    rps: number;
    durationSeconds: number;
  };
  createdAt: string; // ISO-8601
}
```

### Errors

| ErrorCode             | HTTP | When                                  |
| --------------------- | ---- | ------------------------------------- |
| `VALIDATION_ERROR`    | 400  | Invalid profile, SQL, or body         |
| `SESSION_UNAVAILABLE` | 404  | Unknown or expired experiment session |
| `SANDBOX_ERROR`       | 403  | SQL fails sandbox policy              |
| `RATE_LIMITED`        | 429  | Benchmark enqueue quota exceeded      |
| `QUEUE_UNAVAILABLE`   | 503  | Job queue unavailable                 |

---

## GET /benchmarks/:jobId

**Purpose**: Retrieve lifecycle status for the caller's own benchmark job.

### Response (success): `200 OK`

```typescript
interface BenchmarkJobStatusResult {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  profile: {
    rps: number;
    durationSeconds: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  hint?: string;
}
```

### Errors

| ErrorCode   | HTTP | When                                |
| ----------- | ---- | ----------------------------------- |
| `NOT_FOUND` | 404  | Job does not exist                  |
| `FORBIDDEN` | 403  | Job belongs to another user/session |

---

## Internal module exports

| Export                      | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `EnqueueBenchmarkUseCase`   | Programmatic enqueue with same validation as HTTP |
| `GetBenchmarkStatusUseCase` | Status lookup with ownership check                |
| `BenchmarkRunnerModule`     | NestJS module import for lab orchestration        |

---

## Worker contract (BullMQ)

**Queue name**: `benchmark-jobs`

**Job payload**:

```typescript
interface BenchmarkQueuePayload {
  jobId: string;
  userId: string | null;
  sessionId: string;
  profile: { rps: number; durationSeconds: number };
  target: EnqueueBenchmarkDto["target"];
  context?: EnqueueBenchmarkDto["context"];
}
```

**Processor responsibilities**:

1. Transition job to `running`
2. Execute k6 via `K6BenchmarkExecutor`
3. On success: transition to `completed`, attach `k6Summary`, emit `BenchmarkFinished` event for Metrics Pipeline
4. On failure: transition to `failed` with categorized reason

**Retry**: Max 1 retry for transient infrastructure errors; no retry for validation or session errors.

---

## Events

| Event               | Payload                                             | Consumers                                              |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `BenchmarkFinished` | `{ jobId, sessionId, status, k6Summary?, profile }` | Metrics Pipeline (future Benchmark Metrics enrichment) |
