# Data Model: Index Playground

**Feature**: 019-index-playground | **Date**: 2026-07-09

## Overview

No new Platform DB tables required for MVP. Lab catalog row and quiz already exist. This feature adds a **read model** (lab summary content) composed from in-repo curriculum + existing `labs` / `tracks` metadata.

Playground state (indexes created by learners) remains disposable session state on Playground PostgreSQL—not modeled on Platform DB.

## Existing entities (reuse)

### Lab (Platform)

| Field | Notes |
|-------|--------|
| `id` | uuid |
| `slug` | `index-playground` |
| `title` | Index Playground |
| `description` | Short catalog blurb |
| `track_id` | → `database-sql` |
| `sequence_order` | 1 |

### Quiz (Platform)

Existing quiz seed for `index-playground` (Quiz Engine). Summary only references quiz-gated completion (`quizRequired: true` when quiz exists).

### Metric Snapshot (Platform)

Existing Metrics Pipeline snapshots for explain/execution runs scoped by `labSlug=index-playground`. No schema change.

## New logical entities (application content)

### LabSummary (read model)

Not a DB table. Built by UseCase from content registry + Lab entity.

| Field | Type | Rules |
|-------|------|--------|
| `labSlug` | string | Must match catalog lab |
| `trackSlug` | string | From lab’s track |
| `title` | string | From lab or content override |
| `learningGoal` | string | Required; B-Tree index impact |
| `theory` | string | Short narrative (1–3 paragraphs) |
| `guidedSteps` | LabGuidedStep[] | Ordered, ≥3 steps; must include explain before/after and create index |
| `recommendedQuery` | GuidedSql | Parameterized `users` email lookup |
| `recommendedCreateIndexSql` | string | `CREATE INDEX … ON users(email)` |
| `recommendedDropIndexSql` | string | Matching `DROP INDEX …` |
| `quizRequired` | boolean | `true` when quiz exists for lab |
| `dataset` | DatasetHint | family/version/tier suggestion for prepare |
| `optionalBenchmarkNote` | string \| null | P2; may be null or short pointer to Benchmark Runner |

### LabGuidedStep

| Field | Type | Rules |
|-------|------|--------|
| `order` | number | 1-based ascending |
| `title` | string | Short |
| `instruction` | string | What to do |
| `action` | enum | `run_sql` \| `run_explain` \| `run_explain_analyze` \| `create_index_sql` \| `drop_index_sql` \| `compare_metrics` \| `take_quiz` \| `optional_benchmark` |

### GuidedSql

| Field | Type | Rules |
|-------|------|--------|
| `sql` | string | Parameterized; e.g. `SELECT id, email, name FROM users WHERE email = $1` |
| `exampleParameters` | unknown[] | Bound values for placeholders; e.g. `["user1@example.com"]` |
| `paramHints` | string[] | Human hints for FE / learners |
| `description` | string | Why this query |

### DatasetHint

| Field | Type | Rules |
|-------|------|--------|
| `family` | string | `commerce` |
| `version` | string | `v1` |
| `recommendedTier` | string[] | e.g. `['100k','1m']` — prefer tiers where seq vs index is obvious |

## Canonical guided pair (content constants)

```text
recommendedQuery.sql:
  SELECT id, email, name FROM users WHERE email = $1

recommendedQuery.exampleParameters:
  ["user1@example.com"]

recommendedCreateIndexSql:
  CREATE INDEX idx_users_email ON users (email)

recommendedDropIndexSql:
  DROP INDEX IF EXISTS idx_users_email
```

Exact index name may use `IF NOT EXISTS` / `IF EXISTS` variants if sandbox allows; document the strings the lab tests use.

## Relationships

```text
Track (database-sql)
  └── Lab (index-playground)
        ├── LabSummary (content registry, 1:1 by slug)
        ├── Quiz (existing, 0..1)
        └── MetricSnapshots (many, via Metrics Pipeline, labSlug filter)
```

## Validation rules

- Summary requested for unknown slug → not found
- Summary for lab whose track is not `active` → forbidden (align with quiz)
- `guidedSteps` must be non-empty and sorted by `order`
- Recommended SQL/DDL non-empty for Index Playground
- Content registry MUST define an entry for `index-playground` at ship time

## State transitions

None on Platform. Playground index presence:

```text
[no idx_users_email] --CREATE INDEX--> [index present] --DROP INDEX--> [no index]
Dataset Reset / new session --> [no index] (deterministic baseline)
```

## Out of model

- FE chart series
- Benchmark job entities (existing Benchmark Runner)
- New quiz tables
