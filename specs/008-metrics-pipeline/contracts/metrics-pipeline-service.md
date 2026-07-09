# API Contract: Metrics Pipeline

**Feature**: 008-metrics-pipeline | **Module**: `MetricsPipelineModule` | **Base path**: `/experiments`

All responses use the standard API envelope: `{ success, data, meta, error }`.

---

## Inline metrics on existing endpoints

Metrics Pipeline **extends** success payloads from Experiment Runner and Explain Runner — no new run endpoints for MVP.

### POST /experiments/sql/run (extended success)

```typescript
interface ExperimentRunResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  fields?: ExperimentFieldMeta[];
  dataset: { family: string; tier: DatasetTier; version: string };
  statementKind: SqlStatementKind;
  // Added by Metrics Pipeline
  metrics: MetricContract[];
  runId: string;
}
```

### POST /experiments/sql/explain (extended success)

```typescript
interface ExplainRunResult {
  plan: ExplainPlanNode;
  planningTimeMs?: number;
  executionTimeMs: number;
  explainMode: ExplainMode;
  statementKind: ExplainMode;
  dataset: { family: string; tier: DatasetTier; version: string };
  truncated?: boolean;
  rawPlanText?: string;
  // Added by Metrics Pipeline
  metrics: MetricContract[];
  runId: string;
}
```

### MetricContract

```typescript
interface MetricContract {
  key: string;
  label: string;
  unit: string;
  value: number;
  group: string;
}
```

**Rules**:

1. `metrics` MUST be present on every **successful** run/explain response (may be empty array only when catalog resolves to zero applicable entries — not expected for Database Track MVP).
2. Failed responses MUST NOT include `metrics` or `runId`.
3. Frontend MUST display engineering measurements from `metrics[]` only — not by re-deriving from `executionTimeMs`, `rowCount`, or `plan` tree.

---

## GET /experiments/metrics/history

**Purpose**: Retrieve persisted metric snapshots for before/after comparison within a lab session.

### Query parameters: `GetMetricHistoryDto`

```typescript
interface GetMetricHistoryQuery {
  sessionId: string;   // required
  labSlug?: string;    // optional filter
  limit?: number;      // default 50, max retention cap
}
```

### Response (success): `200 OK`

```typescript
interface MetricHistoryResponse {
  snapshots: Array<{
    runId: string;
    runType: 'execution' | 'explain';
    createdAt: string;
    metrics: MetricContract[];
    dataset: { family: string; tier: string; version: string };
  }>;
  retentionLimit: number;
}
```

### Errors

| Code | When |
| ---- | ---- |
| VALIDATION_ERROR | Missing or invalid sessionId |
| NOT_FOUND | Session unknown (when session store validates) |

---

## Catalog resolution

1. Resolve `metricCatalogId` from Track Registry using `context.trackSlug` when provided.
2. Default to `database-metrics` when track context absent (Database Track MVP fallback).
3. Collectors emit only keys defined in resolved catalog.

---

## Observability

```typescript
{
  event: 'metric_snapshot_persisted';
  phase: 'completed' | 'failed';
  runType: 'execution' | 'explain';
  sessionId: string;
  labSlug?: string;
  metricCount: number;
  omittedMetricCount?: number;
  requestId?: string;
}
```

**Note**: Audit events MUST NOT include full SQL, row payloads, or raw plan text.
