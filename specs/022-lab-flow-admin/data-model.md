# Data Model: Lab Flow Admin

**Feature**: `022-lab-flow-admin` | **Date**: 2026-07-12

Platform DB only. No playground tables.

## Lab (existing — unchanged)

Table: `labs` — catalog metadata from 021. Flow content references `labs.id` via FK.

---

## Lab Summary Curriculum (new)

Table: `lab_summary_curricula` — **1:1** with Lab.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| lab_id | uuid | unique, FK → labs ON DELETE RESTRICT | One curriculum per Lab |
| learning_goal | text | NOT NULL | Maps to `learningGoal` |
| theory | text | NOT NULL | |
| recommended_query | jsonb | NOT NULL | `{ sql, exampleParameters, paramHints, description }` |
| recommended_create_index_sql | text | nullable | Index labs; clear via PATCH null |
| recommended_drop_index_sql | text | nullable | Clear via PATCH null |
| dataset | jsonb | NOT NULL | `{ family, version, recommendedTier }` |
| quiz_required | boolean | NOT NULL, default false | |
| optional_benchmark_note | text | nullable | Clear via PATCH null |
| created_at / updated_at | timestamptz | | |

### Curriculum validation

- Parent Lab must exist → else `NOT_FOUND`
- Create when curriculum already exists → `CONFLICT`
- Create requires: `learningGoal`, `theory`, `recommendedQuery`, `dataset`, `quizRequired` (boolean); optional nullable SQL/note fields
- `recommendedQuery` MUST include `sql` (string), `exampleParameters` (array), `paramHints` (string array), `description` (string)
- `dataset` MUST include `family`, `version` (strings), `recommendedTier` (string array)
- PATCH: omitted fields unchanged; explicit `null` allowed only on nullable columns listed above; `null` on required fields → `VALIDATION_ERROR`

### Curriculum lifecycle

| Event | Result |
|-------|--------|
| Admin create | Insert row |
| Admin PATCH | Partial update |
| Seed (Index Playground, empty) | Insert once |
| Seed (content exists) | Skip |
| Learner summary | Require row; else `NOT_FOUND` |

No hard delete in MVP (lab soft-hide via status remains catalog concern).

---

## Lab Guided Step (new)

Table: `lab_guided_steps` — **N:1** Lab.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | Stable id for reorder/delete |
| lab_id | uuid | FK → labs ON DELETE RESTRICT, indexed | |
| display_order | int | NOT NULL | Duplicates allowed; secondary sort by id |
| title | varchar(200) | NOT NULL | |
| instruction | text | NOT NULL | |
| action | varchar(64) | NOT NULL | Must be known `LabGuidedStepAction` |
| payload | jsonb | nullable | **Primary** per-step recommended SQL/DDL. Shapes: `{ recommendedQuery: GuidedSql }` for run/explain; `{ sql: string }` for create/drop index |
| created_at / updated_at | timestamptz | | |

### Step validation

- Parent Lab must exist → else `NOT_FOUND`
- `action` ∈ known set → else `VALIDATION_ERROR`
- Reorder body MUST list every step id for the Lab exactly once → else `VALIDATION_ERROR` (no partial apply)
- Hard delete allowed

### Ordering

List/summary sort: `display_order ASC`, `id ASC`.

Reorder: set `display_order` to `1..N` (or `0..N-1` — pick one in implementation and document in contract) matching request array order, in a single transaction.

### Known actions (existing shared type)

`run_sql` | `run_explain` | `run_explain_analyze` | `create_index_sql` | `drop_index_sql` | `compare_metrics` | `take_quiz` | `optional_benchmark`

---

## Relationships

```text
Lab 1 ── 0..1 LabSummaryCurriculum
Lab 1 ── * LabGuidedStep
```

Learner summary composition:

1. Load Lab (+ Track) for slug + availability gates (existing)
2. Load curriculum by `lab_id` (required)
3. Load steps ordered (include `payload`)
4. Map to `LabSummaryResponse`: each step exposes `payload`; top-level `recommendedQuery` / create / drop SQL are derived from first matching step payload, else curriculum columns

---

## Migration

`1730800000000-CreateLabFlowTablesAndSeedIndexPlayground.ts`

1. Create `lab_summary_curricula` and `lab_guided_steps`
2. Locate Lab `slug = index-playground`
3. If Lab missing → fail migration (catalog must exist from prior seeds)
4. If curriculum exists OR any step exists for that Lab → skip seed
5. Else insert curriculum + steps equivalent to current `INDEX_PLAYGROUND_CONTENT`

---

## Out of scope entities

- Quiz questions/options (Quiz Admin CRUD)
- Lab catalog fields (021)
- Version history / drafts of curriculum
