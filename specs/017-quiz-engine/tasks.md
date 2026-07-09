# Tasks: Quiz Engine

**Input**: Design documents from `/specs/017-quiz-engine/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (constitution requires unit + integration).

**Organization**: Tasks grouped by user story for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Shared quiz types and event contract

- [x] T001 Add shared quiz types (`QuizDefinitionResponse`, `QuizQuestionPublic`, `QuizOptionPublic`, `SubmitQuizRequest`, `SubmitQuizResult`, `QuizResultSummaryResponse`) in `src/shared/quiz/`; export from `src/shared/quiz/index.ts` and `src/shared/index.ts` if required by project convention
- [x] T002 [P] Add `QUIZ_COMPLETED_EVENT` and `QuizCompletedEvent` in `src/shared/quiz/quiz-completed.event.ts`; export from `src/shared/quiz/index.ts`

---

## Phase 2: Foundational

**Purpose**: Schema, entities, repositories, module shell, completion helper — blocks all user stories

**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T003 Add migration `src/database/migrations/1730500000000-CreateQuizTablesAndSeed.ts` creating `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts` per `data-model.md`; seed ≥2 single-select questions for lab `index-playground`; register in `src/database/platform/data-source.ts` if required
- [x] T004 [P] Implement entities in `src/modules/quiz/entities/` (`quiz.entity.ts`, `quiz-question.entity.ts`, `quiz-option.entity.ts`, `quiz-attempt.entity.ts`)
- [x] T005 Implement `QuizRepository` in `src/modules/quiz/infrastructure/quiz.repository.ts` (findByLabSlug with questions/options) and `QuizAttemptRepository` in `src/modules/quiz/infrastructure/quiz-attempt.repository.ts` (insert, listByUserAndQuiz, hasPassingAttempt)
- [x] T006 Extract shared `RecordLabCompletionService` (or equivalent) from `CompleteLabUseCase` into `src/modules/progress/application/record-lab-completion.service.ts` so quiz pass and self-complete share idempotent insert + `lab.completed` emit; keep gate out of this helper
- [x] T007 Create `QuizModule` in `src/modules/quiz/quiz.module.ts` registering entities/repos; import Progress exports as needed; register `QuizModule` in `src/app.module.ts`

**Checkpoint**: Migration applies; repositories can load seeded quiz in unit/integration smoke

---

## Phase 3: User Story 1 — Fetch Quiz Definition (P1) 🎯 MVP

**Goal**: Authenticated definition API without correct-answer leakage

**Independent Test**: JWT `GET /quizzes/labs/index-playground` returns questions/options; payload has no `isCorrect`

### Tests

- [x] T008 [P] [US1] Unit tests for `GetQuizDefinitionUseCase` in `src/modules/quiz/application/get-quiz-definition.usecase.spec.ts` (happy path omits isCorrect, unknown lab, no quiz, inactive track)

### Implementation

- [x] T009 [US1] Implement `GetQuizDefinitionUseCase` + mapper in `src/modules/quiz/application/get-quiz-definition.usecase.ts` and `src/modules/quiz/mappers/quiz.mapper.ts`
- [x] T010 [US1] Add lab-slug param DTO and `GET /quizzes/labs/:labSlug` on `src/modules/quiz/quiz.controller.ts` (JWT required)

**Checkpoint**: Definition read works (SC-002, SC-005 partial)

---

## Phase 4: User Story 2 — Submit Answers and Score (P1)

**Goal**: Grade 100% pass rule, persist attempts, emit `quiz.completed` on pass, record lab completion on pass

**Independent Test**: Submit all-correct → `passed: true`, attempt row, completion exists; wrong answer → `passed: false`, no completion

### Tests

- [x] T011 [P] [US2] Unit tests for grading + `SubmitQuizUseCase` in `src/modules/quiz/application/submit-quiz.usecase.spec.ts` (pass, fail, validation, event on pass only, completion on pass)

### Implementation

- [x] T012 [US2] Implement pure grading helper (optional) and `SubmitQuizUseCase` in `src/modules/quiz/application/submit-quiz.usecase.ts` (validate answers, persist attempt, emit `QUIZ_COMPLETED_EVENT` on pass, call `RecordLabCompletionService` on pass)
- [x] T013 [US2] Add `SubmitQuizDto` in `src/modules/quiz/dto/submit-quiz.dto.ts` and `POST /quizzes/labs/:labSlug/submit` on `src/modules/quiz/quiz.controller.ts`

**Checkpoint**: SC-001/003 write path; unlimited retakes store multiple attempts

---

## Phase 5: User Story 3 — Gate Lab Progress on Quiz Pass (P1)

**Goal**: Self-complete rejected when lab has quiz and user has no passing attempt; ungated labs unchanged

**Independent Test**: `POST /progress/labs/index-playground/complete` → 403 until pass; lab without quiz still completes

### Tests

- [x] T014 [P] [US3] Unit tests updating `src/modules/progress/application/complete-lab.usecase.spec.ts` (gated reject, ungated allow, allow after pass)

### Implementation

- [x] T015 [US3] Update `CompleteLabUseCase` in `src/modules/progress/application/complete-lab.usecase.ts` to reject with `FORBIDDEN` when quiz exists and `hasPassingAttempt` is false; use `RecordLabCompletionService` after gate; wire Progress↔Quiz dependency without circular module crash (forwardRef or quiz-pass port in Progress)

**Checkpoint**: SC-006 gating verified

---

## Phase 6: User Story 4 — Read Own Quiz Results (P2)

**Goal**: Best-score result summary for current user

**Independent Test**: After fail then pass, `GET .../result` shows `passed`, `percentCorrect: 100`, `attemptCount ≥ 2`

### Tests

- [x] T016 [P] [US4] Unit tests for `GetQuizResultUseCase` in `src/modules/quiz/application/get-quiz-result.usecase.spec.ts` (not_attempted, best of many, tie → latest)

### Implementation

- [x] T017 [US4] Implement `GetQuizResultUseCase` in `src/modules/quiz/application/get-quiz-result.usecase.ts`
- [x] T018 [US4] Add `GET /quizzes/labs/:labSlug/result` on `src/modules/quiz/quiz.controller.ts`

**Checkpoint**: SC-007 best-score behavior

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Integration coverage, docs, backlog

- [x] T019 Add integration/e2e tests in `test/integration/quiz-engine.integration-spec.ts` (or project e2e path): definition omit isCorrect, fail then pass → progress, self-complete 403 then pass, auth 401, playground reset does not wipe attempts (SC-004)
- [x] T020 Update Progress contract note if needed in `specs/016-progress-tracking/contracts/progress-tracking-service.md` (gating pointer) and mark Quiz Engine checklist/backlog status toward Implementing/Done as appropriate
- [x] T021 [P] Run `pnpm test` filters for quiz + progress complete-lab; fix regressions

---

## Dependencies

```text
Phase 1 (T001–T002)
    ↓
Phase 2 (T003–T007)  — blocks all stories
    ↓
Phase 3 US1 (T008–T010) 🎯 MVP definition
    ↓
Phase 4 US2 (T011–T013)  — submit/grade/complete-on-pass
    ↓
Phase 5 US3 (T014–T015)  — gate self-complete (can start after T005+T006; ideally after US2)
    ↓
Phase 6 US4 (T016–T018)  — result reads (needs attempts from US2)
    ↓
Phase 7 (T019–T021)
```

**Story completion order**: US1 → US2 → US3 → US4

**Parallel opportunities**: T001∥T002; T004∥T003 after design freeze; T008 before T009; T011 before T012; T014∥T016 once foundations exist

## Implementation strategy

1. Finish Phase 1–2 (types, migration, repos, RecordLabCompletion extract, module).
2. Ship US1 definition API as first demonstrable slice.
3. Ship US2 submit (core learning validation + completion on pass).
4. Ship US3 gating so Progress self-complete cannot bypass quiz.
5. Ship US4 result reads + integration polish.

**MVP scope**: Phases 1–4 (definition + submit/score/complete-on-pass). Gating (US3) should follow immediately so Progress cannot bypass quizzes in environments that seed a quiz.
