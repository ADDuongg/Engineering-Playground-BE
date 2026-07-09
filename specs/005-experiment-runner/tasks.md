# Tasks: Experiment Runner

**Input**: Design documents from `/specs/005-experiment-runner/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types for experiment execution contracts

- [x] T001 [P] Add `ExperimentRunInput` and `ExperimentRunResult` in `src/shared/experiment/` and export from `src/shared/index.ts`
- [x] T002 [P] Scaffold `ExperimentRunnerModule` with imports for `SqlSandboxModule` and `DatasetLoaderModule` in `src/modules/experiment-runner/experiment-runner.module.ts`
- [x] T003 Register `ExperimentRunnerModule` in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core use case with readiness gate — MUST complete before HTTP wiring

- [x] T004 Implement `RunExperimentSqlUseCase` with dataset readiness gate and sandbox delegation in `src/modules/experiment-runner/application/run-experiment-sql.usecase.ts`
- [x] T005 [P] Unit tests for readiness gate, success path, and error passthrough in `run-experiment-sql.usecase.spec.ts`

**Checkpoint**: Use case callable programmatically with readiness enforcement

---

## Phase 3: User Story 1 — Learner Runs SQL and Sees Results (P1) 🎯 MVP

**Goal**: Lab-facing execution returns structured results when dataset is ready

**Independent Test**: Prepare → run SELECT → verify rows, timing, column metadata

### Tests for User Story 1

- [x] T006 [P] [US1] Integration test prepare → run → results in `test/integration/experiment-runner.integration-spec.ts`

### Implementation for User Story 1

- [x] T007 [US1] Add `RunExperimentSqlDto` and POST `/experiments/sql/run` in `dto/run-experiment-sql.dto.ts` and `experiment-runner.controller.ts`
- [x] T008 [US1] Wire `RunExperimentSqlUseCase` in `experiment-runner.module.ts` and map controller context (requestId, userId)

**Checkpoint**: User Story 1 independently testable via HTTP

---

## Phase 4: User Story 2 — Actionable Errors (P1)

**Goal**: Categorized errors for not-ready, sandbox, timeout, and execution failures

**Independent Test**: Trigger each error category and verify message + code

### Tests for User Story 2

- [x] T009 [P] [US2] Unit tests for `DATASET_NOT_READY` per status in `run-experiment-sql.usecase.spec.ts`
- [x] T010 [P] [US2] Integration tests for sandbox violation and syntax error in `experiment-runner.integration-spec.ts`

### Implementation for User Story 2

- [x] T011 [US2] Add status-specific hints for not-ready errors in `run-experiment-sql.usecase.ts`

**Checkpoint**: User Stories 1 and 2 complete

---

## Phase 5: User Story 3 — Playground Isolation (P1)

**Goal**: Execution never touches platform DB

**Independent Test**: Run SQL; assert platform tracks count unchanged

### Tests for User Story 3

- [x] T012 [P] [US3] Integration assertion platform DB unchanged in `experiment-runner.integration-spec.ts`

### Implementation for User Story 3

- [x] T013 [US3] Verify module wiring uses sandbox/playground only — no platform DB injection in `experiment-runner.module.ts`

**Checkpoint**: User Story 3 complete

---

## Phase 6: User Story 4 — Lab Context (P2)

**Goal**: Track/lab context flows through execution and responses

**Independent Test**: Submit with context; verify echoed in logs and sandbox delegation

### Tests for User Story 4

- [x] T014 [P] [US4] Unit test context forwarded to sandbox input in `run-experiment-sql.usecase.spec.ts`

### Implementation for User Story 4

- [x] T015 [US4] Include `dataset` echo and `statementKind` in result mapping in `run-experiment-sql.usecase.ts`

**Checkpoint**: User Story 4 complete

---

## Phase 7: User Story 5 — Auditable Events (P2)

**Goal**: Structured `experiment_sql_run` logs without SQL text

**Independent Test**: Success and failure runs emit audit fields

### Tests for User Story 5

- [x] T016 [P] [US5] Unit tests asserting audit log shape in `run-experiment-sql.usecase.spec.ts`

### Implementation for User Story 5

- [x] T017 [US5] Add structured `experiment_sql_run` logging in `run-experiment-sql.usecase.ts`

**Checkpoint**: All user stories complete

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T018 [P] Map `fields` metadata from sandbox/driver into `ExperimentRunResult` when available
- [x] T019 [P] Swagger decorators on `ExperimentRunnerController`
- [x] T020 Update `specs/005-experiment-runner/spec.md` status to Done when implementation verified
- [x] T021 Update `docs/product/BACKLOG.md` Experiment Runner status and checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 — BLOCKS all user stories
- **Phases 3–7**: Depend on Phase 2
- **Phase 8**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — MVP
- **US2 (P1)**: Builds on US1 error paths
- **US3 (P1)**: Can parallel with US2 after US1
- **US4 (P2)**: After US1 result mapping exists
- **US5 (P2)**: After US1 logging hook exists

### Parallel Opportunities

- T001, T002 in parallel (Phase 1)
- T005, T006 parallel after T004
- T009/T010 parallel in test files

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
2. Validate: prepare dataset, run SQL, verify results and platform isolation
3. Demo-ready experiment execution for Database Track labs

### Incremental Delivery

1. US1 + US2 + US3 → core execution correctness
2. US4 → context attribution
3. US5 → audit polish

---

## Notes

- New `experiment-runner` module — register once in `app.module.ts`
- Reuses `ExecuteSandboxedSqlUseCase`, `GetDatasetMetadataUseCase`
- SQL Execution Queue migration deferred — sync MVP only
- Existing `/sql/sandbox/*` endpoints unchanged
