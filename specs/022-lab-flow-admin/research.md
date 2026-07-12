# Research: Lab Flow Admin

**Feature**: `022-lab-flow-admin` | **Date**: 2026-07-12

## R1 — Storage shape for curriculum vs steps

**Decision**: Two Platform tables — `lab_summary_curricula` (unique `lab_id`) and `lab_guided_steps` (`lab_id` + ordered rows). Do not add curriculum columns onto `labs`.

**Rationale**: Spec separates catalog Lab (021) from flow content; create-once curriculum and empty-steps edge cases are clearer with a distinct 1:1 row; avoids widening catalog entity/migrations already shipped.

**Alternatives considered**:

- Columns on `labs` — couples catalog PATCH with large text/JSON fields; harder “missing curriculum” semantics
- Single JSON document per lab — weaker step CRUD/reorder and indexing; rejected for admin step operations

## R2 — Hard cutover (no registry fallback)

**Decision**: `GetLabSummaryUseCase` loads only from curriculum + steps repositories. Remove runtime dependency on `LabSummaryRegistry` / `INDEX_PLAYGROUND_CONTENT`. Missing curriculum → `NOT_FOUND`.

**Rationale**: Clarification A — single source of truth; prevents silent drift between TS and DB.

**Alternatives considered**:

- Soft fallback to in-repo content — dual source of truth (rejected)
- Hybrid Index-only hard cutover — still leaves registry wired (rejected)

## R3 — Seed skip-if-exists

**Decision**: Migration seeds Index Playground curriculum + steps only when that Lab has no curriculum row and zero guided steps. Any existing curriculum or any step → skip entire seed.

**Rationale**: Clarification — protect admin edits on re-deploy; matches “seed once”.

**Alternatives considered**:

- Always upsert from constants — clobbers admin edits (rejected)
- Partial seed (curriculum if missing, never steps) — can leave inconsistent half-state (rejected)

## R4 — Named curriculum fields + optional step payload

**Decision**: Persist `learningGoal`, `theory`, `recommendedQuery` (JSONB), `recommendedCreateIndexSql`, `recommendedDropIndexSql`, `dataset` (JSONB), `quizRequired`, `optionalBenchmarkNote` as named columns. Step `payload` is optional JSONB for per-step hints only and is not used to populate those summary response fields.

**Rationale**: Clarification — preserve `LabSummaryResponse` without mapper reconstruction from heterogeneous step payloads.

**Alternatives considered**:

- SQL only in step payloads — breaks stable named response fields / harder FE contract (rejected)
- Opaque curriculum JSON blob — weaker validation and admin PATCH ergonomics (rejected)

## R5 — Curriculum create + partial update with null clear

**Decision**: `POST` create (conflict if exists). `PATCH` partial update: omitted keys unchanged; explicit `null` clears nullable columns (`recommendedCreateIndexSql`, `recommendedDropIndexSql`, `optionalBenchmarkNote`, and nullable nested pieces only where product allows). Required string fields (`learningGoal`, `theory`) reject null on PATCH.

**Rationale**: Clarifications on PATCH + null-clear; aligns with Track/Lab admin partial updates.

**Alternatives considered**:

- Full replace only — worse iterative authoring (rejected)
- Upsert single endpoint — unclear create validation and conflict semantics (rejected)

## R6 — Step reorder API

**Decision**: Dedicated reorder endpoint accepting a complete ordered list of step UUIDs for the Lab. Reject if set does not exactly match existing step ids (no partial reorder). Apply new `display_order` 1..N (or 0..N-1 consistently) in one transaction.

**Rationale**: Spec FR-011; avoids ambiguous sparse order updates.

**Alternatives considered**:

- PATCH each step’s order independently — race-prone; incomplete lists leave gaps
- Swap-only API — insufficient for bulk authoring

## R7 — Action type validation

**Decision**: Reuse shared `LabGuidedStepAction` union/enum values already used by Index Playground. Reject unknown actions with `VALIDATION_ERROR`.

**Rationale**: Spec FR-009; keep learner FE action vocabulary stable.

**Alternatives considered**:

- Free-form action strings — breaks FE step UI (rejected)
- Per-track action registries — premature complexity

## R8 — Module placement

**Decision**: Admin HTTP in `src/modules/admin/` (`AdminLabFlowController`). Entities/repos + learner summary read path in `src/modules/labs/`. Export repos from `LabsModule` for admin use cases.

**Rationale**: Mirrors 021 pattern (admin namespace + domain-owned persistence).

**Alternatives considered**:

- All persistence under admin module — wrong ownership for learner summary reads
- New `lab-flow` top-level module — extra boundary without clear gain for MVP

## R9 — Error patterns

**Decision**: Reuse `DomainError` + `ErrorCode`: `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `VALIDATION_ERROR`, `UNAUTHORIZED` via existing guards.

**Rationale**: Consistency with Admin AuthZ and Track/Lab Admin CRUD.

**Alternatives considered**: None material.
