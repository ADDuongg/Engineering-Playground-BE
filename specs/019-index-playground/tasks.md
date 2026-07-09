# Tasks: Index Playground

**Input**: Design documents from `/specs/019-index-playground/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (constitution requires unit + integration).

**Organization**: Tasks grouped by user story for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US6)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Shared lab summary types

- [x] T001 Add shared lab summary types (`LabSummaryResponse`, `LabGuidedStep`, `GuidedSql`, dataset hint types, guided `action` union) in `src/shared/labs/lab-summary.ts`; export from `src/shared/labs/index.ts` and `src/shared/index.ts` if required by project convention

---

## Phase 2: Foundational

**Purpose**: Labs module shell + content registry — blocks summary API stories

**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T002 Create `LabsModule` shell in `src/modules/labs/labs.module.ts` (import Progress/`LabRepository` exports as needed for lab+track lookup); register `LabsModule` in `src/app.module.ts`
- [x] T003 [P] Implement Index Playground curriculum constants in `src/modules/labs/infrastructure/lab-summary.content.ts` per `data-model.md` / clarifications (`users.email` query, `CREATE INDEX`/`DROP INDEX` on `users(email)`, guided steps including explain before/after, dataset commerce/v1 tiers, `quizRequired` true)
- [x] T004 Implement `LabSummaryRegistry` in `src/modules/labs/infrastructure/lab-summary.registry.ts` (resolve content by lab slug; missing content → not found path)

**Checkpoint**: Module loads; registry returns `index-playground` content in unit smoke

---

## Phase 3: User Story 1 — Lab Summary API (P1) 🎯 MVP

**Goal**: Authenticated `GET /labs/:labSlug/summary` with Index Playground curriculum

**Independent Test**: JWT GET summary for `index-playground` returns goal, steps, recommended SQL/DDL, `quizRequired: true`; unknown slug 404; no auth 401

### Tests

- [x] T005 [P] [US1] Unit tests for `GetLabSummaryUseCase` in `src/modules/labs/application/get-lab-summary.usecase.spec.ts` (happy path shape, unknown lab, missing content, inactive track → forbidden)

### Implementation

- [x] T006 [US1] Implement `GetLabSummaryUseCase` + mapper in `src/modules/labs/application/get-lab-summary.usecase.ts` and `src/modules/labs/mappers/lab-summary.mapper.ts` (load lab/track, merge registry content, set `quizRequired` via quiz existence check or content flag consistent with Quiz Engine)
- [x] T007 [US1] Add lab-slug param DTO and `GET /labs/:labSlug/summary` on `src/modules/labs/labs.controller.ts` (JWT required; envelope response)

**Checkpoint**: US1 done — SC-005; MVP demoable without FE

---

## Phase 4: User Story 2 — Before/After SQL + Index DDL (P1)

**Goal**: Documented SQL loop works via existing Experiment Runner; no new DDL endpoints

**Independent Test**: Using summary SQL strings on prepared commerce session: SELECT → CREATE INDEX → SELECT faster → DROP INDEX; sandbox still blocks illegal DDL

### Tests

- [x] T008 [P] [US2] Unit/content tests in `src/modules/labs/infrastructure/lab-summary.content.spec.ts` asserting recommended query targets `users.email`, create/drop DDL target `users(email)`, and steps include `run_sql` + `create_index_sql` + `drop_index_sql`

### Implementation

- [x] T009 [US2] Verify sandbox allowlist still accepts recommended create/drop DDL (extend `src/modules/sql-sandbox/application/validate-sql-statement.service.spec.ts` fixtures if needed for exact lab DDL strings)—no new endpoints
- [x] T010 [US2] Add integration or documented quickstart script notes in `test/integration/index-playground.integration-spec.ts` (or skip-tagged) covering prepare + run recommended SELECT + CREATE INDEX + SELECT via existing experiment APIs when test env has playground DB

**Checkpoint**: FR-002/FR-003 satisfied; SQL-only index actions

---

## Phase 5: User Story 3 — Explain Before/After (P1)

**Goal**: Explain is primary scan comparison path; metrics include rows_scanned / seq_scan_used / index_scan_used

**Independent Test**: Explain guided query without index → seq; with index → index scan; metrics present

### Tests

- [x] T011 [P] [US3] Assert guided steps in `lab-summary.content.ts` / content spec include `run_explain` or `run_explain_analyze` before and after create-index
- [x] T012 [US3] Add/extend integration test in `test/integration/index-playground.integration-spec.ts` (or explain module lab-tagged test) for explain before/after on prepared session asserting scan metric direction (SC-001/SC-002); mark slow if needed

### Implementation

- [x] T013 [US3] Confirm Explain Runner + `CollectExplainMetricsUseCase` already emit required keys for lab comparison; only document mapping in `specs/019-index-playground/contracts/index-playground-service.md` if gaps—no duplicate metric collectors unless a real gap is found

**Checkpoint**: SC-001/SC-002/SC-004 path proven or explicitly env-gated with unit coverage of step content

---

## Phase 6: User Story 4 — Metrics Payload / History (P1)

**Goal**: Explain snapshots usable for before/after charts via existing Metrics Pipeline

**Independent Test**: After explain runs with `labSlug=index-playground`, metric history/read includes scan metrics; plain SQL may omit scan keys

### Tests

- [x] T014 [P] [US4] Unit regression: `src/modules/metrics-pipeline/application/collect-explain-metrics.usecase.spec.ts` still asserts `rows_scanned`, `seq_scan_used`, `index_scan_used`; `collect-execution-metrics` omits scan keys as today

### Implementation

- [x] T015 [US4] Ensure Index Playground explain/experiment calls pass `labSlug=index-playground` in metric context in integration path (fix callers/docs in quickstart only if already correct)—no new metrics APIs

**Checkpoint**: SC-007; chart-ready explain metrics without FE

---

## Phase 7: User Story 5 — Optional Benchmark Mention (P2)

**Goal**: Summary may mention benchmark via existing Benchmark Runner; no new APIs; not a P1 gate

### Implementation

- [x] T016 [P] [US5] Add optional `optionalBenchmarkNote` (or omit) in `src/modules/labs/infrastructure/lab-summary.content.ts` pointing learners to existing Benchmark Runner with guided query; include `optional_benchmark` step only if note present
- [x] T017 [US5] Unit test asserts no Index-specific benchmark route exists under `src/modules/labs/` (controller only exposes summary)

**Checkpoint**: FR-012; P1 remains Done without benchmark jobs

---

## Phase 8: User Story 6 — Quiz Alignment (P2)

**Goal**: Summary indicates quiz gate; existing quiz covers index concepts

### Tests

- [x] T018 [P] [US6] Unit/integration: summary for `index-playground` has `quizRequired: true`; `GET /quizzes/labs/index-playground` still returns definition

### Implementation

- [x] T019 [US6] Review quiz seed in `src/database/migrations/1730500000000-CreateQuizTablesAndSeed.ts`; extend questions/options only if index vs seq-scan coverage is insufficient; keep Quiz Engine APIs unchanged
- [x] T020 [US6] Ensure summary `guidedSteps` include `take_quiz` and theory/instructions state completion requires passing quiz

**Checkpoint**: SC-006; no Quiz Engine rewrite

---

## Phase 9: Polish

**Purpose**: Docs and backlog hygiene

- [x] T021 [P] Align `specs/019-index-playground/quickstart.md` with final route paths and metric key names
- [x] T022 [P] Update `docs/product/BACKLOG.md` Index Playground checklist notes if needed after implementation (status remains Implementing until feature Done)
- [x] T023 Run `pnpm test` for labs/summary specs and fix regressions

---

## Dependencies

```text
Phase 1 → Phase 2 → Phase 3 (US1 MVP)
                ↓
         Phase 4 (US2) ─┬→ Phase 5 (US3) → Phase 6 (US4)
                        └→ (can start after US1 content exists)
Phase 7 (US5) and Phase 8 (US6) after US1 summary exists
Phase 9 after P1 stories (US1–US4) complete
```

## Parallel opportunities

- T003 content || T002 module shell (after T001 types)
- T005 tests || T006 implementation prep
- T008 / T011 / T014 / T016 / T018 content & regression tests in parallel once content file exists
- T021 || T022 docs

## MVP scope

**Ship MVP after Phase 3 (US1)** for API demo; **P1 Done** requires Phases 3–6 (US1–US4). US5–US6 are P2 polish for full lab readiness.

## Independent test criteria (summary)

| Story | Test |
|-------|------|
| US1 | JWT summary returns curriculum; 401/404/403 |
| US2 | Recommended SQL/DDL strings valid; create/drop via experiment APIs |
| US3 | Explain before/after scan metrics direction |
| US4 | Explain metrics keys present; execution omits scan keys |
| US5 | Optional note only; no new benchmark API |
| US6 | `quizRequired` + existing quiz still works |
