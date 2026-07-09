# API Contract: Explain Runner

**Feature**: 007-explain-runner | **Module**: `ExplainRunnerModule` | **Base path**: `/experiments`

All responses use the standard API envelope: `{ success, data, meta, error }`.

---

## POST /experiments/sql/explain

**Purpose**: Run EXPLAIN or EXPLAIN ANALYZE after dataset readiness check; return structured plan tree.

### Request body: `RunExplainDto`

```typescript
interface RunExplainDto {
  sql: string;
  parameters: unknown[];
  explainMode: 'explain' | 'explain_analyze';
  dataset: {
    family: string;
    tier: '100k' | '1m' | '10m';
    version?: string;
  };
  context?: {
    trackSlug?: string;
    labSlug?: string;
  };
  sessionId?: string;
}
```

### Response (success): `200 OK`

```typescript
interface ExplainRunResult {
  plan: ExplainPlanNode;
  planningTimeMs?: number;
  executionTimeMs: number;
  explainMode: 'explain' | 'explain_analyze';
  statementKind: 'explain' | 'explain_analyze';
  dataset: { family: string; tier: string; version: string };
  truncated?: boolean;
  rawPlanText?: string;
}
```

### Errors

Same categories as Experiment Runner: `VALIDATION_ERROR`, `SANDBOX_ERROR`, `TIMEOUT`, `EXECUTION_ERROR` (includes `DATASET_NOT_READY`, `SESSION_NOT_READY`).

---

## Integration rules

1. Inner `sql` MUST NOT include an `EXPLAIN` prefix — use `explainMode` instead.
2. SQL Sandbox remains sole authority for statement validation and timeouts.
3. Metrics Pipeline SHOULD consume explain results in a future feature — not this module's responsibility.

---

## Observability

```typescript
{
  event: 'explain_sql_run';
  phase: 'started' | 'completed' | 'failed';
  explainMode: string;
  family: string;
  version: string;
  tier: string;
  trackSlug?: string;
  labSlug?: string;
  sessionId?: string;
  planNodeCount?: number;
  topLevelNodeType?: string;
}
```
