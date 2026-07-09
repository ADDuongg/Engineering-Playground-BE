# Tasks: Dataset Loader

**Input**: Design documents from `/specs/003-dataset-loader/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types, seed assets, module scaffold, configuration

- [x] T001 [P] Add shared dataset types and enums in `src/shared/dataset/` and export from `src/shared/index.ts`
- [x] T002 [P] Add dataset config keys to `src/config/configuration.ts` and `src/config/env.validation.ts`
- [x] T003 Create commerce seed assets: `seeds/datasets/manifest.json` and `seeds/datasets/commerce/v1/{schema.sql,seed-100k.sql,seed-1m.sql,seed-10m.sql}`
- [x] T004 Create `src/modules/dataset-loader/dataset-loader.module.ts` scaffold and register in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Manifest loading, seed execution, Redis status store — MUST complete before user stories

- [x] T005 [P] Add domain manifest types in `src/modules/dataset-loader/domain/dataset-manifest.types.ts`
- [x] T006 [P] Implement `DatasetManifestRepository` in `src/modules/dataset-loader/infrastructure/dataset-manifest.repository.ts`
- [x] T007 [P] Unit tests for manifest repository in `src/modules/dataset-loader/infrastructure/dataset-manifest.repository.spec.ts`
- [x] T008 Implement `DatasetSeedRunner` in `src/modules/dataset-loader/infrastructure/dataset-seed.runner.ts`
- [x] T009 Implement `DatasetPreparationStatusStore` in `src/modules/dataset-loader/infrastructure/dataset-preparation-status.store.ts`
- [x] T010 [P] Unit tests for status store in `src/modules/dataset-loader/infrastructure/dataset-preparation-status.store.spec.ts`

**Checkpoint**: Infrastructure ready — use cases can be built

---

## Phase 3: User Story 1 — Lab Starts With Known Baseline Data (P1) 🎯 MVP

**Goal**: Commerce dataset loads into playground with all five tables queryable; sync 100K path returns ready

**Independent Test**: POST prepare commerce/100k/v1 → tables exist with expected row counts

### Tests for User Story 1

- [x] T011 [P] [US1] Unit tests for prepare use case in `src/modules/dataset-loader/application/prepare-dataset.usecase.spec.ts`
- [x] T012 [P] [US1] Integration test 100K load in `test/integration/dataset-loader.integration-spec.ts`

### Implementation for User Story 1

- [x] T013 [US1] Implement `PrepareDatasetUseCase` (sync 100K path) in `src/modules/dataset-loader/application/prepare-dataset.usecase.ts`
- [x] T014 [US1] Add DTOs and `DatasetLoaderController` POST `/datasets/prepare` in `src/modules/dataset-loader/dto/prepare-dataset.dto.ts` and `dataset-loader.controller.ts`
- [x] T015 [US1] Wire module providers and exports in `src/modules/dataset-loader/dataset-loader.module.ts`

**Checkpoint**: User Story 1 independently testable

---

## Phase 4: User Story 2 — Size Tiers Support Realistic Scale (P1)

**Goal**: 1M/10M tiers use async preparation with 202 + poll; row counts scale per tier

**Independent Test**: POST 1m returns preparing; poll until ready; counts exceed 100k tier

### Tests for User Story 2

- [x] T016 [P] [US2] Unit tests for async tier branching in `prepare-dataset.usecase.spec.ts`
- [x] T017 [P] [US2] Integration test async status flow in `test/integration/dataset-loader.integration-spec.ts`

### Implementation for User Story 2

- [x] T018 [US2] Extend `PrepareDatasetUseCase` with async 1M/10M background execution in `prepare-dataset.usecase.ts`
- [x] T019 [US2] Add GET `/datasets/prepare/status` in `dataset-loader.controller.ts`
- [x] T020 [US2] Add deduplication for concurrent prepare requests in `prepare-dataset.usecase.ts`

**Checkpoint**: User Stories 1 and 2 complete

---

## Phase 5: User Story 3 — Labs Receive Dataset Metadata (P2)

**Goal**: Metadata endpoint returns table catalog with descriptions and live counts when ready

**Independent Test**: GET metadata after prepare returns five tables with row counts

### Tests for User Story 3

- [x] T021 [P] [US3] Unit tests for metadata use case in `src/modules/dataset-loader/application/get-dataset-metadata.usecase.spec.ts`

### Implementation for User Story 3

- [x] T022 [US3] Implement `GetDatasetMetadataUseCase` in `src/modules/dataset-loader/application/get-dataset-metadata.usecase.ts`
- [x] T023 [US3] Add GET `/datasets/metadata` and response DTO in `dataset-loader.controller.ts` and `dto/dataset-query.dto.ts`

**Checkpoint**: User Story 3 complete

---

## Phase 6: User Story 4 — Versioned Datasets Stay Reproducible (P2)

**Goal**: Version pinning honored; unknown version returns NOT_FOUND; re-prepare yields equivalent counts

**Independent Test**: Unknown version fails clearly; double prepare same identity yields equivalent counts

### Tests for User Story 4

- [x] T024 [P] [US4] Unit tests for version validation and reproducibility in `prepare-dataset.usecase.spec.ts`

### Implementation for User Story 4

- [x] T025 [US4] Enforce version resolution and NOT_FOUND errors in `dataset-manifest.repository.ts` and `prepare-dataset.usecase.ts`
- [x] T026 [US4] Add structured preparation logging in `prepare-dataset.usecase.ts`

**Checkpoint**: All user stories complete

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T027 [P] Add `@Public()` on dataset endpoints and OpenAPI tags in `dataset-loader.controller.ts`
- [x] T028 Run full test suite `pnpm test && pnpm test:e2e` and fix regressions
- [x] T029 Update BACKLOG.md status to Done when complete

---

## Dependencies & Execution Order

```text
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (Polish)
```

**User story dependencies**:
- US2 depends on US1 (prepare use case must exist)
- US3 depends on US1 (metadata needs preparation + manifest)
- US4 extends US1/US2 validation paths

## Parallel Opportunities

- T001, T002, T005, T006, T007 can run in parallel after T003 manifest exists
- T011, T012 parallel once T013 scaffold exists
- T016, T017 parallel in US2 phase
- T021, T024 parallel in US3/US4 phases

## MVP Scope

**Minimum viable delivery**: Complete through **Phase 3 (User Story 1)** — 100K commerce dataset loads synchronously with all tables ready.

## Implementation Strategy

1. Complete Phase 1–2 first (seeds + infrastructure)
2. Deliver US1 as first demoable increment
3. Add US2 async tiers before large-scale lab wiring
4. US3 metadata for lab shell integration
5. US4 version hardening and observability
