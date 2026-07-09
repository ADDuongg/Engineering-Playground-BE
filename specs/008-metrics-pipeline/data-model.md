# Data Model: Metrics Pipeline

## MetricContract

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| key | string | yes | Stable catalog key, e.g. `execution_time_ms` |
| label | string | yes | Human-readable name |
| unit | string | yes | e.g. `ms`, `rows`, `count` |
| value | number | yes | Measured or encoded value |
| group | string | yes | UI grouping: `performance`, `scan`, `plan` |

## MetricCatalogEntry

| Field | Type | Notes |
| ----- | ---- | ----- |
| key | string | Matches MetricContract.key |
| label | string | Display default |
| unit | string | Display unit |
| group | string | Panel section |
| source | enum | `execution`, `explain`, `combined` |

## MetricRunContext

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| trackSlug | string | no | From request context |
| labSlug | string | no | From request context |
| sessionId | string | yes | Experiment session scope |
| requestId | string | no | Correlation |
| userId | string | no | When auth available |
| runType | enum | yes | `execution`, `explain` |
| dataset | object | yes | family, tier, version |

## MetricSnapshot (Platform DB entity)

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| id | uuid | yes | Primary key |
| sessionId | string | yes | Indexed |
| labSlug | string | no | Indexed with session |
| trackSlug | string | no | |
| runType | string | yes | `execution` \| `explain` |
| datasetFamily | string | yes | |
| datasetTier | string | yes | |
| datasetVersion | string | yes | |
| metrics | jsonb | yes | MetricContract[] |
| omittedMetricKeys | jsonb | no | Keys skipped due to insufficient source data |
| requestId | string | no | |
| createdAt | timestamptz | yes | Chronological ordering |

**Indexes**: `(sessionId, labSlug, createdAt)` for history queries.

**Retention**: Delete oldest rows when count for `(sessionId, labSlug)` exceeds configured max (default 50).

## Extended run result envelopes

### ExperimentRunResult (additive)

| Field | Type | Notes |
| ----- | ---- | ----- |
| metrics | MetricContract[] | Inline catalog metrics for this run |
| runId | string | Snapshot id for history correlation |

### ExplainRunResult (additive)

| Field | Type | Notes |
| ----- | ---- | ----- |
| metrics | MetricContract[] | Plan-derived + timing metrics |
| runId | string | Snapshot id |

## Database Track MVP catalog (`database-metrics`)

| key | label | unit | group | Source |
| --- | ----- | ---- | ----- | ------ |
| execution_time_ms | Execution Time | ms | performance | execution / explain |
| rows_returned | Rows Returned | rows | scan | execution |
| rows_scanned | Rows Scanned | rows | scan | explain plan aggregation |
| index_scan_used | Index Scan Used | count | scan | explain (0 or 1) |
| seq_scan_used | Sequential Scan Used | count | scan | explain (0 or 1) |
| planning_time_ms | Planning Time | ms | plan | explain analyze |
| plan_total_cost | Plan Total Cost | cost | plan | explain root node |
| plan_execution_time_ms | Plan Execution Time | ms | plan | explain analyze |

## MetricHistoryResponse

| Field | Type | Notes |
| ----- | ---- | ----- |
| snapshots | MetricSnapshotSummary[] | Ordered ascending by createdAt |
| retentionLimit | number | Configured max |

## MetricSnapshotSummary

| Field | Type | Notes |
| ----- | ---- | ----- |
| runId | string | Snapshot id |
| runType | string | |
| createdAt | string | ISO timestamp |
| metrics | MetricContract[] | Full set at capture time |
| dataset | object | family, tier, version |
