# API Contract: Index Playground / Lab Summary

**Feature**: 019-index-playground | **Module**: `LabsModule` (lab summary) | **Base path**: `/labs`

All JSON responses use the standard API envelope: `{ success, data, meta, error }` unless noted.

Experiment SQL, Explain, Dataset prepare/reset, Metrics history, Quiz, and Benchmark continue to use their existing contracts. This feature adds **lab summary** and documents the guided Index Playground learning loop against those APIs.

---

## GET /labs/:labSlug/summary

**Purpose**: Authenticated lab summary (curriculum + guided SQL/DDL) for FE / clients without hard-coding Index Playground content.

**Auth**: JWT required

### Response `200 OK`

```typescript
interface LabSummaryResponse {
  labSlug: string;
  trackSlug: string;
  title: string;
  learningGoal: string;
  theory: string;
  guidedSteps: LabGuidedStep[];
  recommendedQuery: {
    sql: string;
    /** Values for $1..$n — clients MUST send these (or overrides) when running/explaining the guided query */
    exampleParameters: unknown[];
    paramHints: string[];
    description: string;
  };
  recommendedCreateIndexSql: string;
  recommendedDropIndexSql: string;
  quizRequired: boolean;
  dataset: {
    family: string;
    version: string;
    recommendedTier: string[];
  };
  /** Present when optional benchmark is documented; omit or null if unused */
  optionalBenchmarkNote?: string | null;
}

interface LabGuidedStep {
  order: number;
  title: string;
  instruction: string;
  action:
    | 'run_sql'
    | 'run_explain'
    | 'run_explain_analyze'
    | 'create_index_sql'
    | 'drop_index_sql'
    | 'compare_metrics'
    | 'take_quiz'
    | 'optional_benchmark';
}
```

### Index Playground content requirements

For `labSlug=index-playground`:

- `recommendedQuery.sql` MUST be a parameterized equality filter on `users.email`
- `recommendedQuery.exampleParameters` MUST be a non-empty array matching `$1..$n` (e.g. `["user1@example.com"]`) so FE/clients do not run with `parameters: []`
- `recommendedCreateIndexSql` MUST create a B-Tree index on `users(email)`
- `recommendedDropIndexSql` MUST drop that index
- `guidedSteps` MUST include explain (or explain analyze) **before** and **after** create-index, plus create-index and run_sql steps
- `quizRequired` MUST be `true` while a quiz exists for the lab
- Scan-type comparison instructions MUST point at Explain metrics (`rows_scanned`, `seq_scan_used`, `index_scan_used`), not plain SQL run metrics

### FE usage — binding guided query parameters

**Do not** inline the email into SQL. Keep `$1` and send bound parameters.

When calling Experiment Runner or Explain Runner with `recommendedQuery.sql`:

```typescript
// From GET /labs/index-playground/summary → data.recommendedQuery
const { sql, exampleParameters } = summary.recommendedQuery;

await runSql({
  sql, // "SELECT id, email, name FROM users WHERE email = $1"
  parameters: exampleParameters, // ["user1@example.com"]
  // ...dataset, sessionId, context.labSlug = "index-playground"
});

await runExplain({
  sql,
  parameters: exampleParameters, // same array — required
  explainMode: 'explain_analyze',
  // ...
});
```

| Field | FE must send |
|-------|----------------|
| `sql` | `recommendedQuery.sql` (unchanged, keep `$1`) |
| `parameters` | `recommendedQuery.exampleParameters` (or user override of same length) |

`CREATE INDEX` / `DROP INDEX` from summary use `parameters: []` (no placeholders).

Running guided SELECT/EXPLAIN with `parameters: []` → sandbox `NON_PARAMETERIZED` / validation error.

### Errors

| ErrorCode | HTTP | When |
|-----------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `NOT_FOUND` | 404 | Unknown lab slug, or no summary content registered for slug |
| `FORBIDDEN` | 403 | Lab’s Track is not `active` |

---

## Reused contracts (no new endpoints)

| Step | Existing API | Notes |
|------|----------------|-------|
| Prepare dataset | Dataset Loader prepare/status | Use summary `dataset` hint; labSlug `index-playground` |
| Provision session | Experiment Isolation | As required by runners |
| Run guided SELECT / CREATE INDEX / DROP INDEX | Experiment Runner SQL | Sandbox allowlist; SQL from summary |
| Explain before/after | Explain Runner | **Primary** source of `rows_scanned`, `seq_scan_used`, `index_scan_used` |
| Metric history | Metrics Pipeline | Filter by lab / run ids from explain results |
| Quiz | Quiz Engine `GET/POST /quizzes/labs/:labSlug` | Completion gate |
| Optional benchmark | Benchmark Runner enqueue/status | P2 mention only; no Index-specific API |

### Explain metrics (comparison contract)

Explain responses already enrich Metric Contract entries. For Index Playground before/after teaching, clients MUST treat these keys as the scan comparison surface:

| key | Meaning for lab |
|-----|-----------------|
| `rows_scanned` | Estimated/actual rows touched in plan summary |
| `seq_scan_used` | `1` if sequential scan present |
| `index_scan_used` | `1` if index scan present |
| `planning_time_ms` / `plan_execution_time_ms` | When explain analyze |

Plain SQL experiment runs MAY omit scan keys (`omittedMetricKeys`); that is expected.

---

## Shared types

Place public summary types under `src/shared/labs/` (e.g. `lab-summary.ts`) and export via shared index per project convention. Controllers map to response DTOs without duplicating shapes.
