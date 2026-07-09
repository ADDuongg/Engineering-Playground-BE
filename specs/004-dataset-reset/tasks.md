# Tasks: Dataset Reset

**Input**: Design documents from `/specs/004-dataset-reset/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types and enum extension for reset lifecycle

- [x] T001 [P] Add `RESETTING` to `DatasetReadinessStatus` in `src/shared/dataset/dataset-readiness-status.enum.ts`
- [x] T002 [P] Add `ResetDatasetInput` and `ResetDatasetResult` in `src/shared/dataset/` and export from `src/shared/index.ts`
- [x] T003 [P] Add `markResetting` to `DatasetPreparationStatusStore` in `src/modules/dataset-loader/infrastructure/dataset-preparation-status.store.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Playground teardown helper — MUST complete before reset use case

- [x] T004 Implement `DatasetPlaygroundTeardown` in `src/modules/dataset-loader/infrastructure/dataset-playground-teardown.ts`
- [x] T005 [P] Unit tests for teardown (drops extra tables, preserves allowlist logic) in `dataset-playground-teardown.spec.ts`
- [x] T006 [P] Unit tests for `markResetting` status transitions in `dataset-preparation-status.store.spec.ts`

**Checkpoint**: Teardown and status infrastructure ready

---

## Phase 3: User Story 1 — Learner Restores Baseline After Experiment Changes (P1) 🎯 MVP

**Goal**: Mutated playground restored to manifest baseline via sync 100K reset

**Independent Test**: Prepare → mutate → reset → row counts and schema match baseline

### Tests for User Story 1

- [x] T007 [P] [US1] Unit tests for `ResetDatasetUseCase` sync path in `reset-dataset.usecase.spec.ts`
- [x] T008 [P] [US1] Integration test mutation → reset → baseline in `test/integration/dataset-reset.integration-spec.ts`

### Implementation for User Story 1

- [x] T009 [US1] Implement `ResetDatasetUseCase` (sync 100K: teardown → seed → ready) in `reset-dataset.usecase.ts`
- [x] T010 [US1] Add `ResetDatasetDto` and POST `/datasets/reset` in `dto/reset-dataset.dto.ts` and `dataset-loader.controller.ts`
- [x] T011 [US1] Wire `ResetDatasetUseCase` in `dataset-loader.module.ts`

**Checkpoint**: User Story 1 independently testable

---

## Phase 4: User Story 2 — No Cross-Experiment State Leakage (P1)

**Goal**: Learner-created indexes, rows, and extra tables removed after reset

**Independent Test**: CREATE INDEX + INSERT + CREATE TABLE → reset → none persist

### Tests for User Story 2

- [x] T012 [P] [US2] Integration tests for index/insert/extra-table removal in `dataset-reset.integration-spec.ts`

### Implementation for User Story 2

- [x] T013 [US2] Ensure teardown drops non-manifest tables and seed runner restores baseline indexes only in `dataset-playground-teardown.ts` + `reset-dataset.usecase.ts`

**Checkpoint**: User Stories 1 and 2 complete

---

## Phase 5: User Story 3 — Platform Data Remains Untouched (P1)

**Goal**: Reset never modifies platform DB; metadata reflects restored state

**Independent Test**: Platform tracks count unchanged; metadata shows baseline after reset

### Tests for User Story 3

- [x] T014 [P] [US3] Integration assertion platform DB unchanged in `dataset-reset.integration-spec.ts`

### Implementation for User Story 3

- [x] T015 [US3] Verify reset use case uses only `PlaygroundDatabaseService` (no platform DB injection) — document in module wiring review

**Checkpoint**: User Story 3 complete

---

## Phase 6: User Story 4 — Reset Completes Within Learner-Acceptable Time (P2)

**Goal**: 1M/10M async reset with 202 + poll; 100K under 30s

**Independent Test**: POST 1m reset returns `resetting`; poll until `ready`

### Tests for User Story 4

- [x] T016 [P] [US4] Unit tests for async tier branching in `reset-dataset.usecase.spec.ts`
- [x] T017 [P] [US4] Integration test async reset status flow in `dataset-reset.integration-spec.ts`

### Implementation for User Story 4

- [x] T018 [US4] Extend `ResetDatasetUseCase` with async 1M/10M background execution mirroring prepare pattern
- [x] T019 [US4] Add GET `/datasets/reset/status` in `dataset-loader.controller.ts`
- [x] T020 [US4] Add deduplication for concurrent reset requests in `reset-dataset.usecase.ts`

**Checkpoint**: User Story 4 complete

---

## Phase 7: User Story 5 — Reset Events Are Auditable (P2)

**Goal**: Structured `dataset_reset` logs for start, complete, fail

**Independent Test**: Trigger reset; verify log fields in use case tests

### Tests for User Story 5

- [x] T021 [P] [US5] Unit tests asserting audit log shape in `reset-dataset.usecase.spec.ts`

### Implementation for User Story 5

- [x] T022 [US5] Add structured `dataset_reset` logging in `reset-dataset.usecase.ts`

**Checkpoint**: All user stories complete

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T023 [P] Conflict handling: return in-flight status when `preparing` or `resetting` in `reset-dataset.usecase.ts`
- [x] T024 [P] Map lock/seed failures to educational `DomainError` with hints in `reset-dataset.usecase.ts`
- [x] T025 Update `specs/004-dataset-reset/spec.md` status to Done when implementation verified
- [x] T026 Update `docs/product/BACKLOG.md` Dataset Reset status and checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 — BLOCKS all user stories
- **Phases 3–7**: Depend on Phase 2
- **Phase 8**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — MVP
- **US2 (P1)**: Builds on US1 teardown path
- **US3 (P1)**: Can parallel with US2 after US1
- **US4 (P2)**: After US1 sync path works
- **US5 (P2)**: After US1 logging hook exists

### Parallel Opportunities

- T001, T002, T003 in parallel (Phase 1)
- T004–T006: T005/T006 parallel after T004 interface defined
- T007/T008 parallel; T012/T014 parallel in integration file

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
2. Validate: mutate playground, reset, verify baseline and platform isolation
3. Demo-ready reset for 100K commerce labs

### Incremental Delivery

1. US1 + US2 + US3 → core reset correctness
2. US4 → large-tier async
3. US5 → audit polish

---

## Notes

- Extends `dataset-loader` module — no new NestJS module registration in `app.module.ts`
- Reuses `DatasetSeedRunner`, `DatasetManifestRepository`, `DatasetPreparationStatusStore`
- Worker Queue migration deferred to Worker Queue Foundation epic
