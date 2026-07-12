# API Contract: Index Playground / Lab Summary

**Feature**: 019-index-playground | **Module**: `LabsModule` (lab summary) | **Base path**: `/labs`

All JSON responses use the standard API envelope: `{ success, data, meta, error }` unless noted.

Content is Platform-backed (Lab Flow Admin). Experiment SQL, Explain, Dataset, Metrics, Quiz, and Benchmark reuse existing contracts.

**Canonical FE mapping for guided Apply SQL**: prefer `guidedSteps[].payload` (see below). Top-level `recommendedQuery` / create / drop remain for compatibility.

Also documented in [022 Lab Flow Admin](../../022-lab-flow-admin/contracts/lab-flow-admin-api.md).

---

## GET /labs/:labSlug/summary

**Purpose**: Authenticated lab summary (curriculum + guided steps with per-step Apply SQL) for FE.

**Auth**: JWT required

### Response `200 OK`

```typescript
interface GuidedSql {
  sql: string;
  /** Values for $1..$n — clients MUST send these (or overrides) when running/explaining */
  exampleParameters: unknown[];
  paramHints: string[];
  description: string;
}

interface LabGuidedStepPayload {
  /** SELECT / EXPLAIN — use for run_sql, run_explain, run_explain_analyze */
  recommendedQuery?: GuidedSql;
  /** DDL — use for create_index_sql, drop_index_sql with parameters: [] */
  sql?: string;
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
  /** Per-step Apply content; null when no SQL (compare_metrics, take_quiz, …) */
  payload: LabGuidedStepPayload | null;
}

interface LabSummaryResponse {
  labSlug: string;
  trackSlug: string;
  title: string;
  learningGoal: string;
  theory: string;
  guidedSteps: LabGuidedStep[];
  /**
   * Compatibility field — derived from first matching step payload, else curriculum.
   * New FE SHOULD use guidedSteps[i].payload instead.
   */
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql: string;
  recommendedDropIndexSql: string;
  quizRequired: boolean;
  dataset: {
    family: string;
    version: string;
    recommendedTier: string[];
  };
  optionalBenchmarkNote?: string | null;
}
```

### Index Playground content requirements

For `labSlug=index-playground`:

- Steps with `run_sql` / `run_explain` / `run_explain_analyze` MUST expose `payload.recommendedQuery` with parameterized equality filter on `users.email` and non-empty `exampleParameters`
- `create_index_sql` step MUST expose `payload.sql` creating a B-Tree index on `users(email)`
- `drop_index_sql` step MUST expose `payload.sql` dropping that index
- `guidedSteps` MUST include explain (or explain analyze) **before** and **after** create-index, plus create-index and run_sql steps
- Top-level `recommendedQuery` / create / drop MUST still be populated (derived from steps) for older clients
- `quizRequired` MUST be `true` while a quiz exists for the lab
- Scan-type comparison instructions MUST point at Explain metrics (`rows_scanned`, `seq_scan_used`, `index_scan_used`)

---

## FE mapping — Guided path Apply buttons

**Preferred (per step):**

```typescript
function resolveApplySql(step: LabGuidedStep): {
  sql: string;
  parameters: unknown[];
} | null {
  if (!step.payload) return null;

  switch (step.action) {
    case 'run_sql':
    case 'run_explain':
    case 'run_explain_analyze': {
      const q = step.payload.recommendedQuery;
      if (!q?.sql) return null;
      return { sql: q.sql, parameters: q.exampleParameters ?? [] };
    }
    case 'create_index_sql':
    case 'drop_index_sql': {
      if (!step.payload.sql) return null;
      return { sql: step.payload.sql, parameters: [] };
    }
    default:
      return null;
  }
}

// Apply query on step
const apply = resolveApplySql(step);
if (apply) {
  await runSql({
    sql: apply.sql,
    parameters: apply.parameters,
    // dataset, sessionId, context.labSlug = summary.labSlug
  });
}

// Apply explain on step
if (
  step.action === 'run_explain' ||
  step.action === 'run_explain_analyze'
) {
  const apply = resolveApplySql(step);
  if (apply) {
    await runExplain({
      sql: apply.sql,
      parameters: apply.parameters,
      explainMode:
        step.action === 'run_explain_analyze'
          ? 'explain_analyze'
          : 'explain',
    });
  }
}
```

| `action` | Read from | `parameters` |
|----------|-----------|-------------|
| `run_sql` | `step.payload.recommendedQuery.sql` | `exampleParameters` |
| `run_explain` / `run_explain_analyze` | same | same |
| `create_index_sql` / `drop_index_sql` | `step.payload.sql` | `[]` |
| `compare_metrics` / `take_quiz` / `optional_benchmark` | no Apply SQL | — |

**Do not** inline the email into SQL. Keep `$1` and send bound parameters.

### Legacy fallback (optional)

Older clients may still use top-level fields:

```typescript
const { sql, exampleParameters } = summary.recommendedQuery;
const createSql = summary.recommendedCreateIndexSql;
const dropSql = summary.recommendedDropIndexSql;
```

Running guided SELECT/EXPLAIN with `parameters: []` → sandbox `NON_PARAMETERIZED` / validation error.

### Example response fragment

```json
{
  "labSlug": "index-playground",
  "guidedSteps": [
    {
      "order": 1,
      "title": "Run the guided lookup (no index)",
      "instruction": "...",
      "action": "run_sql",
      "payload": {
        "recommendedQuery": {
          "sql": "SELECT id, email, name FROM users WHERE email = $1",
          "exampleParameters": ["user1@example.com"],
          "paramHints": ["..."],
          "description": "..."
        }
      }
    },
    {
      "order": 3,
      "action": "create_index_sql",
      "payload": { "sql": "CREATE INDEX idx_users_email ON users (email)" }
    }
  ],
  "recommendedQuery": { "sql": "SELECT ...", "exampleParameters": ["user1@example.com"], "...": "..." },
  "recommendedCreateIndexSql": "CREATE INDEX idx_users_email ON users (email)",
  "recommendedDropIndexSql": "DROP INDEX idx_users_email"
}
```

### Errors

| ErrorCode | HTTP | When |
|-----------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `NOT_FOUND` | 404 | Unknown lab slug, or no curriculum for slug |
| `FORBIDDEN` | 403 | Lab’s Track is not `active`, or lab `coming-soon` |

---

## Reused contracts (no new endpoints)

| Step | Existing API | Notes |
|------|----------------|-------|
| Prepare dataset | Dataset Loader prepare/status | Use summary `dataset` hint; labSlug `index-playground` |
| Provision session | Experiment Isolation | As required by runners |
| Run guided SELECT / CREATE INDEX / DROP INDEX | Experiment Runner SQL | SQL from **step.payload** (or legacy top-level) |
| Explain before/after | Explain Runner | **Primary** source of `rows_scanned`, `seq_scan_used`, `index_scan_used` |
| Metric history | Metrics Pipeline | Filter by lab / run ids from explain results |
| Quiz | Quiz Engine `GET/POST /quizzes/labs/:labSlug` | Completion gate |
| Optional benchmark | Benchmark Runner enqueue/status | P2 mention only; no Index-specific API |

### Explain metrics (comparison contract)

| key | Meaning for lab |
|-----|-----------------|
| `rows_scanned` | Estimated/actual rows touched in plan summary |
| `seq_scan_used` | `1` if sequential scan present |
| `index_scan_used` | `1` if index scan present |
| `planning_time_ms` / `plan_execution_time_ms` | When explain analyze |

Plain SQL experiment runs MAY omit scan keys (`omittedMetricKeys`); that is expected.

---

## Shared types

Public summary types live under `src/shared/labs/lab-summary.ts` (`LabSummaryResponse`, `LabGuidedStep`, `LabGuidedStepPayload`, `GuidedSql`) and export via shared index.
