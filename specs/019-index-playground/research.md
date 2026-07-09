# Research: Index Playground

**Feature**: 019-index-playground | **Date**: 2026-07-09

## R1 — Lab summary storage & delivery

**Decision**: Versioned in-repo content module (TypeScript/JSON constants) served by a dedicated `GET /labs/:labSlug/summary` API; Index Playground content first; shape reusable for later labs. Persist nothing new on Platform DB for summary body (lab row already exists).

**Rationale**: Clarification chose a dedicated summary API. Curriculum copy changes with the lab, not with user state. Avoids CMS complexity (out of scope) while keeping FE free of hardcoded steps. Catalog `labs` table already has slug/title/description.

**Alternatives considered**:
- Extend Track learning-path payload only — rejected (clarification A).
- Markdown files on disk served raw — weaker typing/validation for guided SQL/DDL fields.
- New `lab_summaries` Platform table — unnecessary for MVP static content.

## R2 — Index create/drop path

**Decision**: No dedicated index endpoints. Learners submit recommended `CREATE INDEX` / `DROP INDEX` via existing Experiment Runner + SQL Sandbox allowlist. Summary documents exact DDL strings.

**Rationale**: Clarification B; sandbox already classifies create/drop index; teaches real SQL.

**Alternatives considered**: Convenience wrap endpoints (A/C) — extra surface, duplicates sandbox.

## R3 — Scan type & rows scanned source

**Decision**: Explain / Explain Analyze is the primary comparison path. Reuse `CollectExplainMetricsUseCase` metrics: `rows_scanned`, `seq_scan_used`, `index_scan_used` (Database Track catalog). Map product language “scan type” to these flags (and plan `nodeType` in explain payload)—do **not** require a new `scan_type` string metric unless catalog extension is trivial and desired later.

**Rationale**: Clarification A; execution path already omits plan-derived scan metrics (`omittedMetricKeys` includes `rows_scanned` / scan flags).

**Alternatives considered**: Implicit explain on every SELECT (B) — heavier, duplicates Explain Runner; dedicated compare API (C) — premature.

## R4 — Benchmark scope

**Decision**: Optional/P2 mention in summary pointing at existing Benchmark Runner; no new APIs; no P1 acceptance tests for benchmark.

**Rationale**: Clarification B.

## R5 — Guided query & dataset

**Decision**: Canonical query: parameterized equality on `users.email`. Recommended index: B-Tree on `users(email)`. Dataset: commerce family, default teaching tier `100k` (or larger) so seq vs index difference is reliable. Baseline schema has **no** index on `users.email` (only PK); `orders.user_id` already indexed—do not use that for the demo.

**Rationale**: Clarification A; matches PRD example; schema verified in `seeds/datasets/commerce/v1/schema.sql`.

**Alternatives considered**: `products.sku` — also viable but less aligned with PRD narrative.

## R6 — Module placement

**Decision**: New `LabsModule` (or `IndexPlayground` under `modules/labs`) owning summary UseCase + content registry. Reuse Progress `LabRepository` for slug existence / track status. Do not put curriculum inside Track Registry or Quiz modules.

**Rationale**: Feature-first; summary is lab-scoped learning content, not track config or quiz grading.

## R7 — Quiz alignment

**Decision**: Existing Quiz Engine seed for `index-playground` already covers B-Tree vs seq scan and Index Scan plan nodes. Extend only if summary/quiz review finds gaps; no Quiz Engine rewrite.

**Rationale**: FR-008; seed already present in migration `1730500000000`.

## R8 — Auth & errors

**Decision**: JWT required on lab summary (consistent with progress/quiz). `NOT_FOUND` for unknown slug; `FORBIDDEN` if track not active (mirror quiz pattern). Educational errors for dataset-not-ready remain owned by Dataset/Experiment paths.

## Resolved clarifications (from spec)

| Topic | Choice |
|-------|--------|
| Summary delivery | Dedicated lab-summary API |
| Index actions | SQL via Experiment Runner |
| Scan metrics | Explain-primary |
| Benchmark | Optional P2 mention |
| Guided target | `users.email` + index on `users(email)` |

No remaining NEEDS CLARIFICATION for planning.
