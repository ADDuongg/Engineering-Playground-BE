# Tasks: Quiz Admin CRUD

**Input**: Design documents from `/specs/023-quiz-admin-crud/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included (constitution requires unit + integration; quickstart scenarios)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story label (`[US1]`…`[US4]`)
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared contracts and admin/quiz module wiring for quiz admin writes

- [x] T001 [P] Add admin shared types (`AdminQuizView`, `AdminQuizQuestionView`, `AdminQuizOptionView`, create/update/reorder request types) in `src/shared/quiz/quiz-admin.ts` and export from `src/shared/quiz/index.ts` / `src/shared/index.ts`
- [x] T002 Ensure learner contracts in `src/shared/quiz/quiz-responses.ts` remain unchanged (no `isCorrect` on public options)
- [x] T003 Import/export prep in `src/modules/admin/admin.module.ts` and `src/modules/quiz/quiz.module.ts` for upcoming write repos/controllers (no behavior change yet)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repository writes + answer-key validation — blocks all stories

**CRITICAL**: No user story work until this phase completes

- [x] T004 Extend `QuizRepository` in `src/modules/quiz/infrastructure/quiz.repository.ts` with create/update/delete/find-for-admin (eager questions+options ordered)
- [x] T005 [P] Add question/option write helpers (create with inline options, update prompt/order, delete, option CRUD, transactional reorder) in `src/modules/quiz/infrastructure/` (new `quiz-question.repository.ts` / `quiz-option.repository.ts` or colocated on quiz repo — match plan)
- [x] T006 [P] Implement answer-key validator (≥2 options, exactly one correct; sibling clear on `isCorrect: true`) in `src/modules/admin/application/quiz-answer-key.validator.ts`
- [x] T007 Register/export write repos from `src/modules/quiz/quiz.module.ts` for admin module
- [x] T008 [P] Add `AdminQuizMapper` in `src/modules/admin/mappers/admin-quiz.mapper.ts` (entity → admin views including `isCorrect`)

**Checkpoint**: Repos + answer-key validation + mapper ready

---

## Phase 3: User Story 1 — Admin Quiz Shell CRUD (P1) MVP

**Goal**: Admin create/get/update/delete quiz shell; gate on create; conflict on duplicate

**Independent Test**: Admin creates quiz for lab without one; second create 409; PATCH title; non-admin 403; missing lab 404

### Tests for User Story 1

- [x] T009 [P] [US1] Unit tests for create/update/get/delete quiz use cases in `src/modules/admin/application/*.spec.ts`
- [x] T010 [P] [US1] Integration cases for quiz shell + AuthZ + duplicate conflict in `test/integration/quiz-admin.integration-spec.ts`

### Implementation for User Story 1

- [x] T011 [P] [US1] Add quiz shell DTOs/params in `src/modules/admin/dto/`
- [x] T012 [US1] Implement `CreateLabQuizUseCase`, `UpdateLabQuizUseCase`, `GetAdminLabQuizUseCase`, `DeleteLabQuizUseCase` in `src/modules/admin/application/`
- [x] T013 [US1] Implement `AdminQuizController` quiz shell routes per `specs/023-quiz-admin-crud/contracts/quiz-admin-api.md` with `@Roles(Role.ADMIN)`
- [x] T014 [US1] Register US1 providers in `src/modules/admin/admin.module.ts` and make T009/T010 pass
- [x] T015 [US1] Verify empty-quiz submit is rejected clearly in `src/modules/quiz/application/submit-quiz.usecase.ts` (extend if needed) + unit coverage

**Checkpoint**: Quiz shell admin path independently testable; empty shell gates lab

---

## Phase 4: User Story 2 — Questions & Options Admin (P1)

**Goal**: Atomic question create with inline options; granular option CRUD; question PATCH prompt/order only; answer-key invariants

**Independent Test**: Create question with options; add/update/delete option; reject dual-correct / &lt;2 options; learner definition never includes `isCorrect`

### Tests for User Story 2

- [x] T016 [P] [US2] Unit tests for question/option create/update/delete + answer-key rejects in `src/modules/admin/application/*.spec.ts`
- [x] T017 [P] [US2] Integration: question/option CRUD + learner definition omits `isCorrect` in `test/integration/quiz-admin.integration-spec.ts`

### Implementation for User Story 2

- [x] T018 [P] [US2] Add question/option DTOs in `src/modules/admin/dto/`
- [x] T019 [US2] Implement create/update/delete question use cases (inline options on create; prompt/order on update)
- [x] T020 [US2] Implement create/update/delete option use cases (transactional sibling clear; reject invalid end-state)
- [x] T021 [US2] Wire question/option routes on `AdminQuizController`
- [x] T022 [US2] Register US2 providers and make T016/T017 pass

**Checkpoint**: Question/option admin path independently testable

---

## Phase 5: User Story 3 — Reorder Questions & Options (P1)

**Goal**: Full-set reorder for questions and options; invalid reorder leaves prior order

**Independent Test**: Reorder questions/options; learner definition order matches; incomplete id set → 400

### Tests for User Story 3

- [x] T023 [P] [US3] Unit tests for reorder question/option use cases in `src/modules/admin/application/*.spec.ts`
- [x] T024 [P] [US3] Integration reorder cases in `test/integration/quiz-admin.integration-spec.ts`

### Implementation for User Story 3

- [x] T025 [P] [US3] Add reorder DTOs in `src/modules/admin/dto/`
- [x] T026 [US3] Implement `ReorderQuizQuestionsUseCase` and `ReorderQuizOptionsUseCase` (exact id set; `sequenceOrder` 1..N; transactional)
- [x] T027 [US3] Wire reorder routes on `AdminQuizController`
- [x] T028 [US3] Register US3 providers and make T023/T024 pass

**Checkpoint**: Reorder independently testable

---

## Phase 6: User Story 4 — Delete Quiz; Learner Flows Intact (P1)

**Goal**: Hard delete cascades attempts; keep lab completions; other labs unchanged; self-complete ungated

**Independent Test**: Delete quiz on disposable lab; definition 404; self-complete allowed; completion rows retained; Index (or other) quiz still grades

### Tests for User Story 4

- [x] T029 [P] [US4] Unit: delete use case does not call completion delete; cascades via repo delete
- [x] T030 [P] [US4] Integration: delete → definition 404 + self-complete ok + completions preserved; sibling lab quiz still works in `test/integration/quiz-admin.integration-spec.ts`

### Implementation for User Story 4

- [x] T031 [US4] Finalize `DeleteLabQuizUseCase` cascade behavior (quiz delete only; no Progress completion mutation) and document in use case
- [x] T032 [US4] Make T029/T030 pass; confirm learner submit/grade/gate regression for remaining quizzes

**Checkpoint**: Delete semantics verified

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Docs, backlog, quickstart validation

- [x] T033 [P] Align README short pointer to quiz-admin quickstart in `README.md` if needed
- [x] T034 Update `docs/product/BACKLOG.md` Quiz Admin CRUD status/notes (Spec Ready → Implementing → Review as appropriate)
- [x] T035 Run `specs/023-quiz-admin-crud/quickstart.md` scenarios via e2e; fix gaps
- [x] T036 [P] Ensure `contracts/quiz-admin-api.md` matches shipped routes
- [x] T037 [P] Update `specs/023-quiz-admin-crud/spec.md` Status to Review when implementation complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Start immediately
- **Phase 2 Foundational**: After Setup — **blocks all user stories**
- **US1**: After Phase 2 (MVP)
- **US2**: After US1 controller exists (share `AdminQuizController`)
- **US3**: After US2 (needs questions/options to reorder)
- **US4**: After US1 delete path; integration after US2 content exists for richer cascade cases
- **Polish**: After desired stories complete

### User Story Dependencies

- **US1**: After Phase 2
- **US2**: After US1
- **US3**: After US2
- **US4**: After US1 (delete); preferably after US2 for attempt/completion fixtures

### Parallel Opportunities

- T001/T002; T005/T006/T008; T009/T010; T016/T017; T023/T024; T029/T030; T033/T036

---

## Parallel Example: Foundational

```text
T005 question/option write helpers
T006 quiz-answer-key.validator.ts
T008 admin-quiz.mapper.ts
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 + Phase 2
2. Phase 3 US1 (quiz shell)
3. Validate with admin token + gating on empty shell

### Incremental Delivery

1. US1 Quiz shell
2. US2 Questions + options
3. US3 Reorder
4. US4 Delete + completion preservation e2e
5. Polish

### Suggested MVP scope

US1 + foundational write repos (enough to gate a lab via admin without seed migration).

---

## Notes

- No new tables expected; reuse 017 schema
- Learner `isCorrect` omission is a hard regression check in US2 integration
- Prefer disposable lab for DELETE smoke tests so Index Playground seed quiz is not destroyed in shared envs
