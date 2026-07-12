# API Contract: Lab Flow Admin

**Feature**: lab-flow-admin | **Base path**: `/api/v1/admin` | **Auth scheme**: JWT Bearer + `role: admin`

All responses use the standard envelope (`success`, `data`, `meta`, `error`).

Learner summary: `GET /api/v1/labs/:labSlug/summary` — Platform curriculum + guided steps (hard cutover). Full learner shape and FE mapping: see **Learner summary response** below (also mirrored in [019 Index Playground](../../019-index-playground/contracts/index-playground-service.md)).

---

## Authorization

Same as [Admin AuthZ](../../020-admin-authz/contracts/admin-authz-api.md):

| Caller | Outcome |
|--------|---------|
| No / invalid token | `401 UNAUTHORIZED` |
| `role: user` | `403 FORBIDDEN` |
| `role: admin` | Allowed |

---

## Shared types (`@db-play/types`)

```typescript
type LabGuidedStepAction =
  | 'run_sql'
  | 'run_explain'
  | 'run_explain_analyze'
  | 'create_index_sql'
  | 'drop_index_sql'
  | 'compare_metrics'
  | 'take_quiz'
  | 'optional_benchmark';

interface GuidedSql {
  sql: string;
  /** Bound values for $1..$n — FE MUST send these (or same-length overrides) with the SQL */
  exampleParameters: unknown[];
  paramHints: string[];
  description: string;
}

/**
 * Per-step Apply content (admin-editable via step CRUD).
 * Primary source for FE "Apply query" / "Apply create index" buttons.
 */
interface LabGuidedStepPayload {
  /** SELECT / EXPLAIN recommended statement (run_sql, run_explain, run_explain_analyze) */
  recommendedQuery?: GuidedSql;
  /** DDL string (create_index_sql, drop_index_sql) — use with parameters: [] */
  sql?: string;
}

interface LabGuidedStep {
  order: number;
  title: string;
  instruction: string;
  action: LabGuidedStepAction;
  /** null when step has no Apply SQL (e.g. compare_metrics, take_quiz) */
  payload: LabGuidedStepPayload | null;
}

interface LabSummaryDatasetHint {
  family: string;
  version: string;
  recommendedTier: string[];
}

/** Full learner summary — FE maps Guided path from this */
interface LabSummaryResponse {
  labSlug: string;
  trackSlug: string;
  title: string;
  learningGoal: string;
  theory: string;
  guidedSteps: LabGuidedStep[];
  /**
   * Compatibility / fallback only.
   * Prefer guidedSteps[i].payload for Apply buttons.
   * Derived from first matching step payload, else curriculum columns.
   */
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql: string;
  recommendedDropIndexSql: string;
  quizRequired: boolean;
  dataset: LabSummaryDatasetHint;
  optionalBenchmarkNote?: string | null;
}

interface AdminLabGuidedStepView {
  id: string;
  labSlug: string;
  displayOrder: number;
  title: string;
  instruction: string;
  action: LabGuidedStepAction;
  /** Same payload shapes as learner LabGuidedStepPayload */
  payload: LabGuidedStepPayload | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateLabGuidedStepRequest {
  title: string;
  instruction: string;
  action: LabGuidedStepAction;
  displayOrder: number;
  payload?: LabGuidedStepPayload | null;
}

interface UpdateLabGuidedStepRequest {
  title?: string;
  instruction?: string;
  action?: LabGuidedStepAction;
  displayOrder?: number;
  /** null clears payload; omit leaves unchanged */
  payload?: LabGuidedStepPayload | null;
}

interface ReorderLabGuidedStepsRequest {
  /** Complete ordered list of all step ids for the lab */
  stepIds: string[];
}

interface AdminLabCurriculumView {
  labSlug: string;
  learningGoal: string;
  theory: string;
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql: string | null;
  recommendedDropIndexSql: string | null;
  dataset: LabSummaryDatasetHint;
  quizRequired: boolean;
  optionalBenchmarkNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateLabCurriculumRequest {
  learningGoal: string;
  theory: string;
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql?: string | null;
  recommendedDropIndexSql?: string | null;
  dataset: LabSummaryDatasetHint;
  quizRequired: boolean;
  optionalBenchmarkNote?: string | null;
}

interface UpdateLabCurriculumRequest {
  learningGoal?: string;
  theory?: string;
  recommendedQuery?: GuidedSql;
  recommendedCreateIndexSql?: string | null; // null clears
  recommendedDropIndexSql?: string | null;
  dataset?: LabSummaryDatasetHint;
  quizRequired?: boolean;
  optionalBenchmarkNote?: string | null;
}
```

---

## Learner summary response (FE mapping)

`GET /api/v1/labs/:labSlug/summary` → envelope `data: LabSummaryResponse`

### Payload by `action` (Index Playground)

| `action` | FE Apply source | Runner call |
|----------|-----------------|-------------|
| `run_sql` | `step.payload.recommendedQuery` | Experiment Runner: `sql` + `parameters: exampleParameters` |
| `run_explain` / `run_explain_analyze` | `step.payload.recommendedQuery` | Explain Runner: same sql/parameters; mode from action |
| `create_index_sql` | `step.payload.sql` | Experiment Runner: `sql`, `parameters: []` |
| `drop_index_sql` | `step.payload.sql` | Experiment Runner: `sql`, `parameters: []` |
| `compare_metrics` / `take_quiz` / `optional_benchmark` | `payload` usually `null` | Use Metrics / Quiz / Benchmark APIs (no step SQL) |

### Example `guidedSteps` slice (index-playground)

```json
[
  {
    "order": 1,
    "title": "Run the guided lookup (no index)",
    "instruction": "...",
    "action": "run_sql",
    "payload": {
      "recommendedQuery": {
        "sql": "SELECT id, email, name FROM users WHERE email = $1",
        "exampleParameters": ["user1@example.com"],
        "paramHints": ["Pass parameters: [\"user1@example.com\"] ..."],
        "description": "Selective equality lookup on users.email ..."
      }
    }
  },
  {
    "order": 3,
    "title": "Create the B-Tree index",
    "instruction": "...",
    "action": "create_index_sql",
    "payload": {
      "sql": "CREATE INDEX idx_users_email ON users (email)"
    }
  },
  {
    "order": 7,
    "title": "Optional: drop index and re-check",
    "instruction": "...",
    "action": "drop_index_sql",
    "payload": {
      "sql": "DROP INDEX idx_users_email"
    }
  },
  {
    "order": 9,
    "title": "Take the quiz",
    "instruction": "...",
    "action": "take_quiz",
    "payload": null
  }
]
```

### Recommended FE Apply helper

```typescript
function resolveApplySql(step: LabGuidedStep): {
  sql: string;
  parameters: unknown[];
} | null {
  if (!step.payload) return null;

  if (
    step.action === 'run_sql' ||
    step.action === 'run_explain' ||
    step.action === 'run_explain_analyze'
  ) {
    const q = step.payload.recommendedQuery;
    if (!q?.sql) return null;
    return { sql: q.sql, parameters: q.exampleParameters ?? [] };
  }

  if (
    step.action === 'create_index_sql' ||
    step.action === 'drop_index_sql'
  ) {
    if (!step.payload.sql) return null;
    return { sql: step.payload.sql, parameters: [] };
  }

  return null;
}
```

**Do not** inline bound values into SQL. Keep `$1` and send `parameters`.

Top-level `recommendedQuery` / `recommendedCreateIndexSql` / `recommendedDropIndexSql` remain for older clients; new FE SHOULD prefer `guidedSteps[].payload`.

---

## Admin endpoints

Base path prefix: `/api/v1/admin`

### Guided steps

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/labs/:labSlug/steps` | 200 | List steps (`{ steps: AdminLabGuidedStepView[] }`) |
| POST | `/labs/:labSlug/steps` | 201 | Create step (include `payload` for Apply SQL) |
| GET | `/labs/:labSlug/steps/:stepId` | 200 | Get one step |
| PATCH | `/labs/:labSlug/steps/:stepId` | 200 | Partial update (`payload: null` clears) |
| DELETE | `/labs/:labSlug/steps/:stepId` | 204 | Hard delete |
| POST | `/labs/:labSlug/steps/reorder` | 200 | Body `{ stepIds: string[] }` — full set, exact once |

### Curriculum

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/labs/:labSlug/curriculum` | 200 | Get curriculum |
| POST | `/labs/:labSlug/curriculum` | 201 | Create (conflict if exists) |
| PATCH | `/labs/:labSlug/curriculum` | 200 | Partial update; omit unchanged; null clears nullable fields |

Curriculum SQL fields are compatibility/fallback; **prefer editing step `payload`** for Apply content.

### Admin PATCH step payload example

```http
PATCH /api/v1/admin/labs/index-playground/steps/{stepId}
Authorization: Bearer <admin>
Content-Type: application/json

{
  "payload": {
    "recommendedQuery": {
      "sql": "SELECT id, email, name FROM users WHERE email = $1",
      "exampleParameters": ["user1@example.com"],
      "paramHints": ["pass email"],
      "description": "lookup"
    }
  }
}
```

```http
PATCH /api/v1/admin/labs/index-playground/steps/{stepId}

{
  "payload": {
    "sql": "CREATE INDEX idx_users_email ON users (email)"
  }
}
```

---

## Error cases

| Condition | Code | HTTP |
|-----------|------|------|
| Lab slug unknown | `NOT_FOUND` | 404 |
| Step id unknown / not in lab | `NOT_FOUND` | 404 |
| Curriculum missing (GET/PATCH) | `NOT_FOUND` | 404 |
| Curriculum already exists (POST) | `CONFLICT` | 409 |
| Unknown action / invalid body / bad reorder set | `VALIDATION_ERROR` | 400 |
| Non-admin | `FORBIDDEN` | 403 |
| Unauthenticated | `UNAUTHORIZED` | 401 |

### Learner summary errors

| Condition | Code | HTTP |
|-----------|------|------|
| Missing / invalid token | `UNAUTHORIZED` | 401 |
| Unknown lab or no curriculum | `NOT_FOUND` | 404 |
| Track/Lab not startable | `FORBIDDEN` | 403 |

---

## Out of scope

- DELETE curriculum
- Quiz question admin (see 023)
- FE admin UI
- Playground writes
