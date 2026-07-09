# API Contract: Realtime Progress

**Feature**: 015-realtime-progress | **Module**: `BenchmarkRunnerModule` | **Base path**: `/api/v1/benchmarks`

In-run progress uses **SSE** (not the JSON envelope). Status / metrics endpoints remain JSON-enveloped as today.

---

## GET /benchmarks/:jobId/progress

**Purpose**: Push-only live progress stream for one benchmark job owned by the caller.

**Content-Type**: `text/event-stream`

**Auth**: Same as status — `@Public()` with optional Bearer JWT; ownership via user id **or** `sessionId` query.

### Query

```typescript
interface ObserveBenchmarkProgressQuery {
  sessionId?: string; // required when unauthenticated (same as GET /benchmarks/:jobId)
}
```

### SSE event types

| event | data | When |
| ----- | ---- | ---- |
| `progress` | `BenchmarkProgressSnapshot` JSON | Initial snapshot (or status-seeded) and each ~1 Hz update |
| `terminal` | `BenchmarkProgressSnapshot` JSON with `terminal: true` | Job completed/failed/cancelled — then stream closes |
| `error` | `{ code: string; message: string }` | Auth/ownership/not-found before stream starts, or fatal stream error |

Recommended wire format:

```text
event: progress
data: {"jobId":"...","phase":"running","elapsedMs":4200,"elapsedBasis":"execution","currentRps":98.5,"partialMetrics":[...],"provisional":true,"terminal":false,"updatedAt":"..."}

event: terminal
data: {"jobId":"...","phase":"completed","elapsedMs":10050,"elapsedBasis":"execution","provisional":true,"terminal":true,"updatedAt":"..."}
```

### Snapshot payload

```typescript
interface PartialMetric {
  key: string;
  label: string;
  unit: string;
  value: number;
  group: string;
  provisional: true;
}

interface BenchmarkProgressSnapshot {
  jobId: string;
  phase: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  elapsedMs: number;
  elapsedBasis: 'queue' | 'execution';
  currentRps?: number | null;
  partialMetrics?: PartialMetric[];
  provisional: true;
  terminal: boolean;
  profile?: { rps: number; durationSeconds: number };
  updatedAt: string;
  hint?: string;
}
```

### Behavior rules

1. **Push-only**: This endpoint is the sole in-run progress mechanism. Clients MUST NOT poll `GET /benchmarks/:jobId` for progress UX.
2. **Connect**: After ownership check, emit latest Redis snapshot if present; else if job non-terminal, emit status-seeded phase/elapsed (no invented RPS/partial); else if already terminal, emit `terminal` and close.
3. **Subscribe**: Forward Redis pub/sub updates for `jobId` as `progress` events until `terminal: true` or client disconnect.
4. **Cadence**: Upstream publishes ≤ ~1 Hz; duplicates may be coalesced.
5. **Terminal**: `terminal` event MUST NOT include final Metric Contract `metrics[]`. Client uses status / `GET /benchmarks/:jobId/metrics` for finals.
6. **Disconnect**: Unsubscribe Redis channel; release observer resources (FR-011).
7. **No envelope**: Do not wrap SSE frames in `{ success, data, meta, error }`.

### Errors (before stream / as `error` event)

| ErrorCode | HTTP (pre-stream) | When |
| --------- | ----------------- | ---- |
| `NOT_FOUND` | 404 | Unknown or non-benchmark job |
| `FORBIDDEN` | 403 | Caller does not own job |
| `VALIDATION_ERROR` | 400 | Missing `sessionId` when required |

Once headers are flushed for SSE, prefer `event: error` then close rather than changing HTTP status.

---

## Unchanged (handoff)

| Endpoint | Role after terminal |
| -------- | ------------------- |
| `GET /benchmarks/:jobId` | Lifecycle + embedded finals when `metricsStatus: ready` |
| `GET /benchmarks/:jobId/metrics` | Dedicated finals |
| `GET /benchmarks/metrics/history` | Comparison history |

---

## Internal: Worker → Redis

Not a public HTTP API. Worker / executor:

1. On `markRunning` → write + publish snapshot `phase: running`.
2. On each throttled interim observation → update `currentRps` / `partialMetrics` + publish.
3. On completed/failed → write + publish `terminal: true` snapshot (no finals).

Channel: `benchmark:progress:channel:{jobId}`  
Key: `benchmark:progress:{jobId}`

---

## Observability

Structured logs (no SQL text):

| Event | Fields |
| ----- | ------ |
| `benchmark_progress_published` | jobId, phase, hasPartialMetrics, terminal |
| `benchmark_progress_observe_start` | jobId, seededFromStatus |
| `benchmark_progress_observe_end` | jobId, reason (`terminal` \| `disconnect` \| `error`) |

---

## Client sequence (lab)

```text
POST /benchmarks → jobId
GET  /benchmarks/:jobId/progress (SSE) → progress… → terminal (close)
GET  /benchmarks/:jobId  (and/or /metrics) → finals when ready
```
