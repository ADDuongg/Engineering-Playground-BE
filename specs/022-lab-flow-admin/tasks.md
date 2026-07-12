# Tasks: Lab Flow Admin

**Input**: Design documents from `/specs/022-lab-flow-admin/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included (constitution requires unit + integration; quickstart scenarios)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story label (`[US1]`…`[US4]`)
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared contracts and admin/labs module wiring for lab-flow writes

- [x] T001 [P] Add admin shared types (`AdminLabGuidedStepView`, `CreateLabGuidedStepRequest`, `UpdateLabGuidedStepRequest`, `ReorderLabGuidedStepsRequest`, `AdminLabCurriculumView`, `CreateLabCurriculumRequest`, `UpdateLabCurriculumRequest`) in `src/shared/labs/lab-flow-admin.ts` and export from `src/shared/index.ts`
- [x] T002 Ensure `LabGuidedStepAction` / `LabSummaryResponse` remain the learner contract source of truth in `src/shared/labs/lab-summary.ts` (no breaking renames)
- [x] T003 Import/export prep in `src/modules/admin/admin.module.ts` and `src/modules/labs/labs.module.ts` for upcoming entities/repos/controllers (no behavior change yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Platform tables, repositories, action validation — blocks all stories

**CRITICAL**: No user story work until this phase completes

- [x] T004 Add `LabSummaryCurriculumEntity` in `src/modules/labs/entities/lab-summary-curriculum.entity.ts`
- [x] T005 [P] Add `LabGuidedStepEntity` in `src/modules/labs/entities/lab-guided-step.entity.ts`
- [x] T006 Create migration `src/database/migrations/1730800000000-CreateLabFlowTablesAndSeedIndexPlayground.ts` (create tables; seed Index Playground only if no curriculum and zero steps; register in `src/database/platform/data-source.ts` and `platform-database.module.ts`)
- [x] T007 Implement `LabSummaryCurriculumRepository` in `src/modules/labs/infrastructure/lab-summary-curriculum.repository.ts`
- [x] T008 [P] Implement `LabGuidedStepRepository` in `src/modules/labs/infrastructure/lab-guided-step.repository.ts` (ordered list, create/update/delete, transactional reorder)
- [x] T009 [P] Add action validator for known `LabGuidedStepAction` values in `src/modules/admin/application/lab-guided-step-action.validator.ts`
- [x] T010 Register entities/repos in `src/modules/labs/labs.module.ts` and export repos for admin module

**Checkpoint**: Schema + repos + action validation ready

---

## Phase 3: User Story 1 — Admin Manages Guided Steps (P1) MVP

**Goal**: Admin CRUD + reorder for guided steps scoped to a Lab

**Independent Test**: Admin creates/lists/updates/deletes/reorders steps; non-admin 403; missing lab 404

### Tests for User Story 1

- [x] T011 [P] [US1] Unit tests for create/update/delete/reorder step use cases in `src/modules/admin/application/*.spec.ts`
- [x] T012 [P] [US1] Integration cases for step CRUD/reorder + AuthZ in `test/integration/lab-flow-admin.integration-spec.ts`

### Implementation for User Story 1

- [x] T013 [P] [US1] Add step DTOs (create/update/reorder/params) in `src/modules/admin/dto/`
- [x] T014 [US1] Implement create/update/delete/list/get step use cases in `src/modules/admin/application/`
- [x] T015 [US1] Implement `ReorderLabGuidedStepsUseCase` (exact id set; `displayOrder` 1..N; transactional) in `src/modules/admin/application/reorder-lab-guided-steps.usecase.ts`
- [x] T016 [US1] Implement `AdminLabFlowController` step routes per `specs/022-lab-flow-admin/contracts/lab-flow-admin-api.md` with `@Roles(Role.ADMIN)`
- [x] T017 [US1] Register US1 providers in `src/modules/admin/admin.module.ts` and make T011/T012 pass

**Checkpoint**: Step admin path independently testable

---

## Phase 4: User Story 2 — Admin Manages Lab Summary Curriculum (P1)

**Goal**: Create-once + partial update curriculum with null-clear for nullable fields

**Independent Test**: Admin creates curriculum, PATCHes fields, clears nullable with null; duplicate create 409; non-admin 403

### Tests for User Story 2

- [x] T018 [P] [US2] Unit tests for create/update/get curriculum use cases (omit unchanged; null clears) in `src/modules/admin/application/*.spec.ts`
- [x] T019 [P] [US2] Integration cases for curriculum create/PATCH/null-clear + conflict in `test/integration/lab-flow-admin.integration-spec.ts`

### Implementation for User Story 2

- [x] T020 [P] [US2] Add curriculum DTOs with null-aware PATCH validation in `src/modules/admin/dto/`
- [x] T021 [US2] Implement `CreateLabCurriculumUseCase`, `UpdateLabCurriculumUseCase`, `GetLabCurriculumUseCase` in `src/modules/admin/application/`
- [x] T022 [US2] Wire curriculum routes on `AdminLabFlowController` (`GET/POST/PATCH .../curriculum`)
- [x] T023 [US2] Register US2 providers and make T018/T019 pass

**Checkpoint**: Curriculum admin path independently testable

---

## Phase 5: User Story 3 — Learner Summary Reads Platform Content (P1)

**Goal**: Hard cutover — `GetLabSummaryUseCase` loads curriculum + steps from DB; preserve response shape

**Independent Test**: With Platform content present, learner summary returns steps/curriculum; missing curriculum → 404; no registry fallback

### Tests for User Story 3

- [x] T024 [P] [US3] Unit tests: `get-lab-summary.usecase.spec.ts` uses repos (not registry); missing curriculum NOT_FOUND; empty steps allowed
- [x] T025 [P] [US3] Integration: learner summary for seeded Index Playground matches Platform content field shape in `test/integration/lab-flow-admin.integration-spec.ts`

### Implementation for User Story 3

- [x] T026 [US3] Update `toLabSummaryResponse` / mapper in `src/modules/labs/mappers/lab-summary.mapper.ts` to accept curriculum entity + steps
- [x] T027 [US3] Rewrite `GetLabSummaryUseCase` in `src/modules/labs/application/get-lab-summary.usecase.ts` to load from repos only (keep Track/Lab active gates; quizRequired OR quiz exists)
- [x] T028 [US3] Remove runtime wiring of `LabSummaryRegistry` from `GetLabSummaryUseCase` and `labs.module.ts` providers if unused
- [x] T029 [US3] Make T024/T025 pass

**Checkpoint**: Learner summary hard-cutover verified

---

## Phase 6: User Story 4 — Seed Index Playground Once (P1)

**Goal**: Migration seeds Index content once; re-run skips when curriculum or any steps exist

**Independent Test**: Fresh DB after migrate has Index content; second seed path does not duplicate/overwrite

### Tests for User Story 4

- [x] T030 [P] [US4] Integration/assertion: after migrate, Index Playground has curriculum + expected step count; admin-edited instruction survives re-migrate/skip in `test/integration/lab-flow-admin.integration-spec.ts` (or migration-focused test documented in quickstart)

### Implementation for User Story 4

- [x] T031 [US4] Finalize seed SQL/data in `1730800000000-CreateLabFlowTablesAndSeedIndexPlayground.ts` from `INDEX_PLAYGROUND_CONTENT` equivalence (titles, orders, actions, learning goal, recommended SQL)
- [x] T032 [US4] Delete or quarantine runtime-only `src/modules/labs/infrastructure/lab-summary.content.ts` / `lab-summary.registry.ts` / related specs so they are not a fallback path (keep git history; remove imports)
- [x] T033 [US4] Make T030 pass; confirm learner summary works without content file

**Checkpoint**: Seed + cutover complete

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Docs, backlog, quickstart validation

- [x] T034 [P] Align README short pointer to lab-flow admin quickstart in `README.md` if needed
- [x] T035 Update `docs/product/BACKLOG.md` Lab Flow Admin checklist/notes (Status → Review/Done as appropriate)
- [x] T036 Run `specs/022-lab-flow-admin/quickstart.md` scenarios via e2e; fix gaps
- [x] T037 [P] Ensure `contracts/lab-flow-admin-api.md` matches shipped routes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Start immediately
- **Phase 2 Foundational**: After Setup — **blocks all user stories**
- **US1**: After Phase 2 (MVP)
- **US2**: After Phase 2 (can parallel with US1 if different files; prefer after US1 controller exists to share `AdminLabFlowController`)
- **US3**: After US1+US2 write paths exist OR after seed (US4) provides readable content — practically after T007–T010 and preferably after seed for Index e2e
- **US4**: Seed can land in T006 early; finalize content + delete registry after US3 cutover (T031–T032)
- **Polish**: After desired stories complete

### User Story Dependencies

- **US1**: After Phase 2
- **US2**: After Phase 2
- **US3**: After repos exist; needs seed or admin-created content for Index e2e
- **US4**: Seed skip logic in migration; registry removal after US3

### Parallel Opportunities

- T001/T002; T004/T005; T007/T008; T011/T012; T018/T019; T024/T025

---

## Parallel Example: Foundational

```text
T004 LabSummaryCurriculumEntity
T005 LabGuidedStepEntity
T009 action validator
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 + Phase 2
2. Phase 3 US1 (step CRUD/reorder)
3. Validate with admin token

### Incremental Delivery

1. US1 Steps admin
2. US2 Curriculum admin
3. US4 Seed Index content (if not already in T006)
4. US3 Learner hard cutover + remove registry
5. Polish

### Suggested MVP scope

US1 + foundational tables (curriculum table created even if US2 follows immediately).

---

## Notes

- Hard cutover: no `LabSummaryRegistry` fallback
- Seed skips if curriculum OR any steps exist for Index Playground
- Curriculum: create-once; PATCH omit=unchanged; null clears nullable fields
- Reorder: complete id list; `displayOrder` 1..N
- Step hard delete allowed; no curriculum DELETE in MVP
- All admin routes under `/api/v1/admin/*` with `@Roles(Role.ADMIN)`
- Commit after each task or logical group when asked
