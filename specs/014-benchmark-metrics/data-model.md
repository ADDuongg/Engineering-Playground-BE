# Data Model: Benchmark Metrics

## MetricContract (unchanged shape)

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| key | string | yes | Catalog key |
| label | string | yes | Display label |
| unit | string | yes | `ms`, `rps`, `%` |
| value | number | yes | Numeric only |
| group | string | yes | e.g. `latency`, `throughput`, `reliability` |

## MetricRunType (extended)

| Value | Meaning |
| ----- | ------- |
| `execution` | SQL run (existing) |
| `explain` | EXPLAIN run (existing) |
| `benchmark` | Load benchmark (new) |

## MetricSource (extended)

| Value | Meaning |
| ----- | ------- |
| `execution` | From SQL execution |
| `explain` | From plan |
| `combined` | Either |
| `benchmark` | From load-test summary |

## Database Track catalog — benchmark entries

| key | label | unit | group | Source |
| --- | ----- | ---- | ----- | ------ |
| `latency_avg_ms` | Average Latency | ms | latency | benchmark |
| `latency_p95_ms` | P95 Latency | ms | latency | benchmark |
| `latency_p99_ms` | P99 Latency | ms | latency | benchmark |
| `achieved_rps` | Achieved RPS | rps | throughput | benchmark |
| `throughput_rps` | Throughput | rps | throughput | benchmark |
| `error_rate_pct` | Error Rate | % | reliability | benchmark |

**Semantics**:
- `achieved_rps` — all attempts per second
- `throughput_rps` — successful requests per second
- `error_rate_pct` — 0–100 (5.0 = 5%)

## MetricRunContext (extended)

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| sessionId | string | yes | Experiment session |
| trackSlug | string | no | |
| labSlug | string | no | |
| requestId | string | no | Correlation; may equal jobId |
| userId | string | no | |
| runType | enum | yes | includes `benchmark` |
| dataset | object | yes | From benchmark target |
| metricCatalogId | string | no | Default `database-metrics` |
| jobId | string | yes* | *Required for benchmark collection |
| profile | object | yes* | `{ rps, durationSeconds }` for benchmark |

## MetricSnapshot (Platform DB — extended)

Existing columns retained. Additions:

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| jobId | string \| null | no | Unique when set; benchmark job id |
| profile | jsonb \| null | no | Load profile `{ rps, durationSeconds }` |

**Indexes**:
- Existing `(sessionId, labSlug, createdAt)`
- Unique partial index on `job_id` WHERE `job_id IS NOT NULL`

**Retention**: Shared `metrics.retentionLimit` (default 50) per `(sessionId, labSlug)` across all run types, or prune benchmark-only — **Decision**: prune by `(sessionId, labSlug)` across run types (existing behavior) so total history stays bounded.

## Job payloadSummary (benchmark — additive)

| Field | Type | Notes |
| ----- | ---- | ----- |
| metrics | MetricContract[] | Embedded for status when ready |
| runId | string | Snapshot id |
| metricsStatus | `ready` \| `unavailable` \| `pending` | pending while running; ready/unavailable after collection |
| k6Summary | object | Internal only; not required by labs |

## BenchmarkJobStatusResult (extended)

| Field | Type | Notes |
| ----- | ---- | ----- |
| metrics | MetricContract[] \| undefined | Present when `metricsStatus === 'ready'` |
| metricsStatus | `pending` \| `ready` \| `unavailable` \| undefined | undefined/pending when not completed |
| runId | string \| undefined | Snapshot id when persisted |

## BenchmarkMetricsByJobResponse

| Field | Type | Notes |
| ----- | ---- | ----- |
| jobId | string | |
| runId | string | Snapshot id |
| status | string | Job lifecycle (for context) |
| profile | object | rps, durationSeconds |
| metricsStatus | `ready` \| `unavailable` | |
| metrics | MetricContract[] | Empty when unavailable |
| createdAt | string | Snapshot time |
| hint | string \| optional | When unavailable |

## BenchmarkMetricHistoryResponse

| Field | Type | Notes |
| ----- | ---- | ----- |
| snapshots | BenchmarkMetricSnapshotSummary[] | Ascending by createdAt |
| retentionLimit | number | |

### BenchmarkMetricSnapshotSummary

| Field | Type | Notes |
| ----- | ---- | ----- |
| runId | string | |
| jobId | string | |
| runType | `'benchmark'` | |
| createdAt | string | ISO |
| profile | `{ rps, durationSeconds }` | |
| metrics | MetricContract[] | |
| dataset | object | family, tier, version |

## Validation rules

- Collection only when job completed with parseable summary
- No success metrics on failed benchmarks without summary
- Duplicate `job_id` insert → idempotent (ignore or return existing)
- History/metrics-by-job enforce ownership
- No re-collect endpoint
