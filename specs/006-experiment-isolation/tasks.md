# Tasks: Experiment Isolation

**Input**: Design documents from `/specs/006-experiment-isolation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types and module scaffold

- [x] T001 [P] Add `ExperimentSession` shared types and enums in `src/shared/experiment-session/` and export from `src/shared/index.ts`
- [x] T002 [P] Scaffold `ExperimentIsolationModule` in `src/modules/experiment-isolation/experiment-isolation.module.ts`
- [x] T003 Register `ExperimentIsolationModule` in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Session store and schema provisioner — MUST complete before HTTP wiring

- [x] T004 Implement `ExperimentSessionStore` (Redis) in `src/modules/experiment-isolation/infrastructure/experiment-session.store.ts`
- [x] T005 [P] Implement `PlaygroundSchemaProvisioner` (CREATE/DROP SCHEMA) in `playground-schema.provisioner.ts`
- [x] T006 [P] Add `withSchemaScope` helper on `PlaygroundDatabaseService` for scoped queries
- [x] T007 Implement `ProvisionExperimentSessionUseCase` with reuse, Track validation, and recovery in `provision-experiment-session.usecase.ts`
- [x] T008 [P] Unit tests for provision, reuse, unsupported track, and recovery in `provision-experiment-session.usecase.spec.ts`

**Checkpoint**: Session provisionable programmatically with schema created

---

## Phase 3: User Story 1 — Dedicated Experiment Runtime (P1) 🎯 MVP

**Goal**: Session-scoped playground context; concurrent sessions isolated

**Independent Test**: Two sessions → mutate A → B unchanged

### Tests for User Story 1

- [x] T009 [P] [US1] Integration test concurrent session isolation in `test/integration/experiment-isolation.integration-spec.ts`

### Implementation for User Story 1

- [x] T010 [US1] Add `ProvisionExperimentSessionDto` and `POST /experiments/sessions` in controller
- [x] T011 [US1] Wire provision use case in module; map request context

**Checkpoint**: User Story 1 independently testable via HTTP provision + schema verification

---

## Phase 4: User Story 2 — No Prior Execution Dependency (P1)

**Goal**: New sessions start from baseline; reset scoped per session

**Independent Test**: Mutate session A → new session B matches baseline

### Tests for User Story 2

- [x] T012 [P] [US2] Integration test new session baseline independence in `experiment-isolation.integration-spec.ts`

### Implementation for User Story 2

- [x] T013 [US2] Extend `DatasetPreparationStatusStore.buildKey` to accept optional `sessionId`
- [x] T014 [US2] Extend `PrepareDatasetUseCase` and seed runner for session schema scope
- [x] T015 [US2] Extend `ResetDatasetUseCase` for session-scoped reset and status keys
- [x] T016 [US2] Extend dataset metadata/query DTOs with optional `sessionId`

**Checkpoint**: Prepare and reset work per session without global leakage

---

## Phase 5: User Story 3 — Platform Separation (P1)

**Goal**: Platform DB unchanged; session metadata in Redis only

**Independent Test**: Platform counts unchanged after multi-session workload

### Tests for User Story 3

- [x] T017 [P] [US3] Integration assertion platform DB unchanged in `experiment-isolation.integration-spec.ts`

### Implementation for User Story 3

- [x] T018 [US3] Verify no platform DB injection in isolation module wiring

**Checkpoint**: User Stories 1–3 complete

---

## Phase 6: User Story 4 — Track-Aware Adapter (P2)

**Goal**: Database Track provisions PG; unsupported Tracks rejected

**Independent Test**: database-sql succeeds; unknown track returns actionable error

### Tests for User Story 4

- [x] T019 [P] [US4] Unit test unsupported track rejection in `provision-experiment-session.usecase.spec.ts`

### Implementation for User Story 4

- [x] T020 [US4] Resolve Track → RuntimeAdapterType via Track Registry or allowlist in provision use case

**Checkpoint**: User Story 4 complete

---

## Phase 7: User Story 5 — Recovery on Failure (P2)

**Goal**: Failed provision/teardown recoverable with audit logs

**Independent Test**: Simulate provision failure → retry succeeds; audit emitted

### Tests for User Story 5

- [x] T021 [P] [US5] Unit tests for provision failure cleanup and retry in `provision-experiment-session.usecase.spec.ts`
- [x] T022 [P] [US5] Unit tests for teardown failure in `teardown-experiment-session.usecase.spec.ts`

### Implementation for User Story 5

- [x] T023 [US5] Implement `TeardownExperimentSessionUseCase` with partial cleanup recovery
- [x] T024 [US5] Add `GET /experiments/sessions/:id` and `DELETE /experiments/sessions/:id` endpoints
- [x] T025 [US5] Add structured `experiment_session` audit logging in provision and teardown use cases

**Checkpoint**: All user stories complete

---

## Phase 8: Downstream Integration

- [x] T026 Extend `SandboxExecuteInput` and `ExecuteSandboxedSqlUseCase` with optional `sessionId` schema scope
- [x] T027 Extend `ExperimentRunInput`, DTO, and `RunExperimentSqlUseCase` with optional `sessionId` + session readiness gate
- [x] T028 [P] Integration test full flow: provision → prepare → run → teardown

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T029 [P] Swagger decorators on `ExperimentIsolationController`
- [x] T030 Update `specs/006-experiment-isolation/spec.md` status to Done when verified
- [x] T031 Update `docs/product/BACKLOG.md` Experiment Isolation status and checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 — BLOCKS all user stories
- **Phases 3–7**: Depend on Phase 2
- **Phase 8**: Depends on Phases 3–5 minimum
- **Phase 9**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — MVP provision + schema
- **US2 (P1)**: After US1 store/key extension
- **US3 (P1)**: Can parallel with US2 after US1
- **US4 (P2)**: After provision use case exists
- **US5 (P2)**: After teardown use case scaffold

### Parallel Opportunities

- T001, T002 in parallel (Phase 1)
- T005, T006, T008 parallel after T004
- T009/T012/T017 parallel in integration spec file

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
2. Validate: two concurrent sessions, baseline independence, platform unchanged
3. Demo-ready isolated experiment runtime for Database Track labs

### Incremental Delivery

1. US1 + US2 + US3 → core isolation correctness
2. US4 → Track validation
3. US5 → teardown and recovery polish
4. Phase 8 → wire Experiment Runner and Sandbox

---

## Notes

- New `experiment-isolation` module — register once in `app.module.ts`
- Optional `sessionId` on existing APIs preserves backward compatibility
- Schema-per-session on shared Playground PostgreSQL per research.md
- Authentication enriches audit with `userId` when available — not required for MVP
