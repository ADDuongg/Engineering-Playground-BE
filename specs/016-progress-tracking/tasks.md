# Tasks: Progress Tracking

**Input**: Design documents from `/specs/016-progress-tracking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (constitution requires unit + integration).

**Organization**: Tasks grouped by user story for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Shared types and event contract for progress

- [x] T001 Add shared progress types (`LabPathItem`, `TrackLearningPathResponse`, `TrackProgressSummaryResponse`, `CompleteLabResult`) in `src/shared/progress/`; export from `src/shared/progress/index.ts` and `src/shared/index.ts` if required by project convention
- [x] T002 [P] Add `LAB_COMPLETED_EVENT` and `LabCompletedEvent` in `src/shared/progress/lab-completed.event.ts`; export from `src/shared/progress/index.ts`


---

## Phase 2: Foundational

**Purpose**: Schema, entities, repositories, module shell — blocks all user stories

**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T003 Add migration `src/database/migrations/1730400000000-CreateLabsAndUserLabCompletions.ts` creating `labs` and `user_lab_completions` with FKs/indexes per `data-model.md`; seed four MVP labs for `database-sql`; register in `src/database/platform/data-source.ts` if required
- [x] T004 [P] Implement `LabEntity` in `src/modules/progress/entities/lab.entity.ts` and `UserLabCompletionEntity` in `src/modules/progress/entities/user-lab-completion.entity.ts`
- [x] T005 Implement `LabRepository` in `src/modules/progress/infrastructure/lab.repository.ts` (findBySlug, findOrderedByTrackId/slug) and `UserLabCompletionRepository` in `src/modules/progress/infrastructure/user-lab-completion.repository.ts` (findByUserAndLab, insertIgnore/create, listByUserAndTrack)
- [x] T006 Create `ProgressModule` in `src/modules/progress/progress.module.ts` registering entities/repos; import Tracks module/repository as needed; register `ProgressModule` in `src/app.module.ts`

**Checkpoint**: Migration applies; repositories can load seeded labs in unit/integration smoke

---

## Phase 3: User Story 1 — Record Lab Completion (P1) 🎯 MVP

**Goal**: Authenticated self-complete; idempotent; emit `lab.completed` on first insert only

**Independent Test**: JWT user completes `index-playground` → row exists + event; repeat → `alreadyCompleted: true`, no second event

### Tests

- [x] T007 [P] [US1] Unit tests for `CompleteLabUseCase` in `src/modules/progress/application/complete-lab.usecase.spec.ts` (happy path, idempotent, unknown lab, coming-soon track, event only on first)

### Implementation

- [x] T008 [US1] Implement `CompleteLabUseCase` in `src/modules/progress/application/complete-lab.usecase.ts` (validate lab + active track, insert completion, emit `LAB_COMPLETED_EVENT` only when new row)
- [x] T009 [US1] Add `LabSlugParamDto` in `src/modules/progress/dto/lab-slug.param.dto.ts` and `POST /progress/labs/:labSlug/complete` on `src/modules/progress/progress.controller.ts` (JWT required)

**Checkpoint**: MVP write path works (SC-001/002 partial)

---

## Phase 4: User Story 2 — Read Progress for Catalog and Detail (P1)

**Goal**: Authenticated Track progress summary with counts, percent, and per-lab `completed`

**Independent Test**: After one completion, `GET /progress/tracks/database-sql` shows `completedCount: 1` and matching flags

### Tests

- [x] T010 [P] [US2] Unit tests for `GetTrackProgressUseCase` in `src/modules/progress/application/get-track-progress.usecase.spec.ts` (zero progress, partial, unknown track, percent math)

### Implementation

- [x] T011 [US2] Implement `GetTrackProgressUseCase` in `src/modules/progress/application/get-track-progress.usecase.ts` returning `TrackProgressSummaryResponse`
- [x] T012 [US2] Add `GET /progress/tracks/:trackSlug` on `src/modules/progress/progress.controller.ts` (JWT required); reuse track-slug param DTO pattern

**Checkpoint**: SC-001 read-after-write and SC-005 auth reject covered for progress reads

---

## Phase 5: User Story 3 — Learning Path Sequence per Track (P1)

**Goal**: Public ordered learning path without completion flags

**Independent Test**: Unauthenticated `GET /tracks/:trackSlug/learning-path` returns ordered labs; no `completed` field

### Tests

- [x] T013 [P] [US3] Unit tests for `GetLearningPathUseCase` in `src/modules/progress/application/get-learning-path.usecase.spec.ts` (order, empty, unknown track)

### Implementation

- [x] T014 [US3] Implement `GetLearningPathUseCase` in `src/modules/progress/application/get-learning-path.usecase.ts`
- [x] T015 [US3] Expose `@Public() GET /tracks/:trackSlug/learning-path` — either on `ProgressController` with path prefix or extend `TracksController` calling the use case; wire module exports/imports so route matches `contracts/progress-tracking-service.md`

**Checkpoint**: SC-003 stable ordering; public access works

---

## Phase 6: User Story 4 — Progress Survives Playground Reset (P2)

**Goal**: Prove Platform completions are unaffected by playground reset

**Independent Test**: Complete lab → run dataset reset → progress still shows completion

### Tests

- [x] T016 [US4] Integration test in `test/integration/progress-tracking.integration-spec.ts` (or feature e2e): complete → invoke reset path/service → assert completion row and progress API unchanged

### Implementation

- [x] T017 [US4] Confirm no playground FK/writes in progress repositories; document assertion in test only (no production code unless a leak is found)

**Checkpoint**: SC-004 satisfied

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Docs, backlog, contract alignment

- [x] T018 [P] Align Swagger/`@ApiOperation` and error codes with `specs/016-progress-tracking/contracts/progress-tracking-service.md`
- [x] T019 [P] Update `docs/product/BACKLOG.md` Spec Index row for Progress Tracking; set status notes when implementing
- [x] T020 Run unit + integration tests for progress; fix failures; verify `quickstart.md` commands manually or via e2e

---

## Dependencies

```text
Phase 1 → Phase 2 → US1 (Phase 3) → US2 (Phase 4)
                   ↘ US3 (Phase 5) [can parallel US2 after Phase 2]
US1 + US2 → US4 (Phase 6)
All stories → Phase 7
```

## Parallel opportunities

- T001 ∥ T002
- T004 ∥ T003 (entity files while migration drafted)
- T007 ∥ (after T008 interface known) prefer TDD: T007 before T008
- T010 ∥ T013 after Phase 2
- US2 and US3 after Phase 2 can proceed in parallel once US1 write exists for richer US2 fixtures (US3 needs only labs seed)

## Implementation strategy

1. Finish Phase 1–2 (types + migration + module).
2. Deliver US1 MVP (complete + event).
3. Deliver US2 + US3 (read APIs).
4. Add US4 isolation test.
5. Polish and mark backlog Done when all checkboxes pass.

## MVP scope

T001–T009 (Setup + Foundation + US1) is the smallest shippable backend increment.
