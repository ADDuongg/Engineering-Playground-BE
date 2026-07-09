# API Contract: Benchmark Metrics

**Feature**: 014-benchmark-metrics | **Modules**: `MetricsPipelineModule` (collection/history), `BenchmarkRunnerModule` (status embed) | **Base paths**: `/benchmarks`, `/experiments`

All responses use the standard API envelope: `{ success, data, meta, error }`.

---

## Extended: GET /benchmarks/:jobId

**Purpose**: Lifecycle status with embedded metrics when collection succeeded.

### Response (success): `200 OK`

```typescript
interface BenchmarkJobStatusResult {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  profile: { rps: number; durationSeconds: number };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  hint?: string;
  // Added by Benchmark Metrics
  metricsStatus?: 'pending' | 'ready' | 'unavailable';
  metrics?: MetricContract[]; // only when metricsStatus === 'ready'
  runId?: string;
}
```

**Rules**:

1. While `queued` / `running`, `metricsStatus` is `pending` or omitted; no inventing zeros.
2. On `completed` + successful collection → `metricsStatus: 'ready'` and `metrics[]` populated.
3. On `completed` + collection failure → `metricsStatus: 'unavailable'`; no success-looking metrics.
4. On `failed` without usable summary → no success metrics.
5. Labs MUST render charts from `metrics[]` (or dedicated endpoints), never from raw `k6Summary`.

---

## GET /benchmarks/:jobId/metrics

**Purpose**: Dedicated metrics retrieval for one benchmark job (Platform DB source of truth).

### Query (optional ownership for anonymous)

```typescript
interface GetBenchmarkMetricsQuery {
  sessionId?: string; // required when unauthenticated, same as status
}
```

### Response (success): `200 OK`

```typescript
interface BenchmarkMetricsByJobResponse {
  jobId: string;
  runId?: string;
  status: string;
  profile: { rps: number; durationSeconds: number };
  metricsStatus: 'ready' | 'unavailable' | 'pending';
  metrics: MetricContract[];
  createdAt?: string;
  hint?: string;
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `NOT_FOUND` | 404 | Unknown or non-benchmark job |
| `FORBIDDEN` | 403 | Caller does not own job |
| `VALIDATION_ERROR` | 400 | Missing session when required |

When job exists but metrics pending/unavailable → **200** with `metricsStatus` and empty `metrics` (not 404), so UI can distinguish lifecycle vs collection.

---

## GET /benchmarks/metrics/history

**Purpose**: Session-scoped benchmark metric history for before/after comparison.

### Query: `GetBenchmarkMetricHistoryQuery`

```typescript
interface GetBenchmarkMetricHistoryQuery {
  sessionId: string;
  labSlug?: string;
  limit?: number; // default 50, capped by retention
}
```

### Response (success): `200 OK`

```typescript
interface BenchmarkMetricHistoryResponse {
  snapshots: Array<{
    runId: string;
    jobId: string;
    runType: 'benchmark';
    createdAt: string;
    profile: { rps: number; durationSeconds: number };
    metrics: MetricContract[];
    dataset: { family: string; tier: string; version: string };
  }>;
  retentionLimit: number;
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `VALIDATION_ERROR` | 400 | Missing sessionId |
| `FORBIDDEN` | 403 | When auth proves session not owned (if enforced) |

---

## MetricContract

```typescript
interface MetricContract {
  key: string;
  label: string;
  unit: string;
  value: number;
  group: string;
}
```

### Required keys on successful collection

`latency_avg_ms`, `latency_p95_ms`, `latency_p99_ms`, `achieved_rps`, `throughput_rps`, `error_rate_pct`

---

## Internal: collection on `benchmark.finished`

```typescript
// Listener input (existing event)
interface BenchmarkFinishedEvent {
  jobId: string;
  sessionId: string;
  userId: string | null;
  status: 'completed' | 'failed';
  profile: { rps: number; durationSeconds: number };
  k6Summary?: Record<string, unknown>;
  failureReason?: string;
}
```

**Behavior**:

1. Ignore non-completed or missing `k6Summary`.
2. Parse → MetricContract[] → persist snapshot (`runType: 'benchmark'`, `jobId`, `profile`).
3. Update job `payloadSummary` with `metrics`, `runId`, `metricsStatus`.
4. Idempotent on duplicate `jobId`.
5. On failure: `metricsStatus: 'unavailable'`; log; no re-collect API.

### Observability

```typescript
{
  event: 'benchmark_metrics_collected',
  phase: 'completed' | 'failed' | 'skipped',
  jobId: string,
  sessionId: string,
  metricCount?: number,
  profile?: { rps: number; durationSeconds: number },
  reason?: string
}
```

---

## Out of contract (MVP)

- Re-collect / repair endpoints
- Live partial metrics during `running` (Realtime Progress)
- Exposing raw k6 summary on public responses
