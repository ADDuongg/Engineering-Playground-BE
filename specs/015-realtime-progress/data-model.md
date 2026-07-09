# Data Model: Realtime Progress

## BenchmarkProgressSnapshot (ephemeral Redis)

Point-in-time progress for one benchmark job. **Latest only** — overwritten each tick. Not stored in Platform DB.

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| jobId | string | yes | Benchmark job id |
| phase | `'queued' \| 'running' \| 'completed' \| 'failed' \| 'cancelled'` | yes | Aligns with job lifecycle |
| elapsedMs | number | yes | Queued: since `createdAt`; running: since `startedAt` |
| elapsedBasis | `'queue' \| 'execution'` | yes | Clarifies which clock `elapsedMs` uses |
| currentRps | number \| null | no | Measured achieved RPS; null until load observations exist |
| partialMetrics | PartialMetric[] | no | Empty/omitted when no observations; never invent zeros |
| provisional | true | yes | Always `true` for in-run snapshots (including terminal signal payload before close) |
| terminal | boolean | yes | `true` when stream should end (completed/failed/cancelled) |
| profile | `{ rps: number; durationSeconds: number }` | no | From job for UI context |
| updatedAt | string (ISO) | yes | Snapshot write time |
| hint | string | no | Learner-facing note (e.g. waiting in queue) |

### PartialMetric

Same display fields as Metric Contract, plus provisional flag:

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| key | string | yes | Catalog key (`achieved_rps`, `latency_avg_ms`, `error_rate_pct`, …) |
| label | string | yes | From catalog |
| unit | string | yes | `rps`, `ms`, `%` |
| value | number | yes | Numeric; only when measured |
| group | string | yes | Catalog group |
| provisional | true | yes | Always true for in-run preview |

**Allowed mid-run keys (MVP)**: `achieved_rps` (required once measurable), plus `latency_avg_ms` and/or `error_rate_pct` when available. Full six-metric finals remain Benchmark Metrics only.

## Progress Observation Session (runtime, not persisted)

| Field | Type | Notes |
| ----- | ---- | ----- |
| jobId | string | Observed job |
| observerId | string | Connection id (for cleanup) |
| userId / sessionId | string | Ownership context |
| subscribedAt | ISO string | |
| closedAt | ISO string \| null | On disconnect or terminal |

No durable table — lives only while SSE is open.

## Terminal Progress Signal

Not a separate Redis entity. Represented as a `BenchmarkProgressSnapshot` with:

- `terminal: true`
- `phase` ∈ `{ completed, failed, cancelled }`
- **no** final `metrics[]` / Metric Contract array
- optional `hint` pointing learner to status/metrics for finals

## Redis keys

| Key / channel | Value | TTL |
| ------------- | ----- | --- |
| `benchmark:progress:{jobId}` | JSON snapshot | Align with `jobs.statusTtlSeconds` (or feature config); shorten after terminal if desired |
| `benchmark:progress:channel:{jobId}` | Pub/sub channel name | N/A (channel) |

## Relationships

```text
BenchmarkJob (JobStore)
    └── owns → BenchmarkProgressSnapshot (Redis, latest only)
            └── observed by → Progress Observation Session (SSE, ephemeral)

On terminal → stream closes
    └── finals → Benchmark Metrics / status APIs (unchanged)
```

## State transitions (progress phase)

```text
queued ──► running ──► completed (terminal)
                 └──► failed (terminal)
                 └──► cancelled (terminal)
```

- `queued`: phase + queue-elapsed; no `currentRps` / partial metrics
- `running`: phase + execution-elapsed; RPS/partial when observations exist
- terminal phases: one final publish then observers close

## Validation rules

1. Never invent `currentRps` or `partialMetrics` values (including zero) without observations.
2. `provisional` must be true on all progress payloads; labs must not treat as chart history.
3. Ownership required before emitting any snapshot on SSE.
4. Latest-only overwrite; no append-only tick log in MVP.
5. Status seed on missing snapshot: phase + elapsed only; `currentRps` / `partialMetrics` omitted until next observation.
