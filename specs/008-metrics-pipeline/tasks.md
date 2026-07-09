# Tasks: Metrics Pipeline

**Input**: Design documents from `/specs/008-metrics-pipeline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared contracts and module scaffold

- [x] T001 [P] Add `MetricContract`, `MetricSnapshot`, `MetricRunContext` in `src/shared/metrics/` and export from `src/shared/index.ts`
- [x] T002 [P] Extend `ExperimentRunResult` and `ExplainRunResult` with optional `metrics` and `runId` in `src/shared/experiment/` and `src/shared/explain/`
- [x] T003 Scaffold `MetricsPipelineModule` in `src/modules/metrics-pipeline/metrics-pipeline.module.ts`
- [x] T004 Register `MetricsPipelineModule` in `src/app.module.ts`; export collector use cases for runner modules

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catalog, collectors, persistence — MUST complete before runner integration

- [x] T005 [P] Define `MetricCatalogEntry` types and `database-metrics.catalog.ts` in `src/modules/metrics-pipeline/domain/`
- [x] T006 Implement `CollectExecutionMetricsUseCase` in `application/collect-execution-metrics.usecase.ts`
- [x] T007 [P] Implement `CollectExplainMetricsUseCase` with plan tree aggregation in `application/collect-explain-metrics.usecase.ts`
- [x] T008 [P] Unit tests for execution and explain collectors in `*.usecase.spec.ts`
- [x] T009 Create TypeORM migration and `MetricSnapshot` entity in `infrastructure/metric-snapshot.entity.ts`
- [x] T010 Implement `MetricSnapshotRepository` with retention prune in `infrastructure/metric-snapshot.repository.ts`
- [x] T011 Implement `PersistMetricSnapshotUseCase` in `application/persist-metric-snapshot.usecase.ts`
- [x] T012 [P] Unit tests for persistence and retention in `persist-metric-snapshot.usecase.spec.ts`

**Checkpoint**: Collectors and persistence callable programmatically

---

## Phase 3: User Story 1 — Normalized Metrics After SQL Execution (P1) 🎯 MVP

**Goal**: Successful SQL runs return Metric Contract array inline

**Independent Test**: Run SELECT → verify `metrics` with execution time and rows returned

### Tests for User Story 1

- [x] T013 [P] [US1] Unit test execution collector emits required catalog keys in `collect-execution-metrics.usecase.spec.ts`
- [x] T014 [P] [US1] Integration test run response includes metrics in `test/integration/metrics-pipeline.integration-spec.ts`

### Implementation for User Story 1

- [x] T015 [US1] Inject collectors into `RunExperimentSqlUseCase`; attach `metrics` and `runId` on success in `run-experiment-sql.usecase.ts`
- [x] T016 [US1] Call `PersistMetricSnapshotUseCase` after successful execution (non-blocking failure path)

**Checkpoint**: User Story 1 independently testable via POST `/experiments/sql/run`

---

## Phase 4: User Story 2 — Plan-Derived Metrics After EXPLAIN (P1)

**Goal**: Explain success returns scan and plan timing metrics

**Independent Test**: EXPLAIN ANALYZE seq scan vs index scan → distinct scan flags and rows_scanned

### Tests for User Story 2

- [x] T017 [P] [US2] Unit test explain collector for seq vs index plans in `collect-explain-metrics.usecase.spec.ts`
- [x] T018 [P] [US2] Integration test explain response metrics in `metrics-pipeline.integration-spec.ts`

### Implementation for User Story 2

- [x] T019 [US2] Inject collectors into `RunExplainUseCase`; attach `metrics` and `runId` on success in `run-explain.usecase.ts`
- [x] T020 [US2] Persist explain snapshots via `PersistMetricSnapshotUseCase`

**Checkpoint**: User Stories 1 and 2 complete

---

## Phase 5: User Story 3 — Before/After Comparison (P1)

**Goal**: Metric history retrievable per session for comparison UI

**Independent Test**: Two runs → GET history returns ordered snapshots

### Tests for User Story 3

- [x] T021 [P] [US3] Unit test `GetMetricHistoryUseCase` ordering and limit in `get-metric-history.usecase.spec.ts`
- [x] T022 [P] [US3] Integration test history after multiple runs in `metrics-pipeline.integration-spec.ts`

### Implementation for User Story 3

- [x] T023 [US3] Implement `GetMetricHistoryUseCase` in `application/get-metric-history.usecase.ts`
- [x] T024 [US3] Add `GetMetricHistoryDto` and GET `/experiments/metrics/history` in controller

**Checkpoint**: User Story 3 independently testable

---

## Phase 6: User Story 4 — Frontend Consumption Contract (P1)

**Goal**: API contract documents metrics-only consumption; no duplicate timing fields required by UI

**Independent Test**: Contract review + integration asserts all catalog keys present without plan parsing

### Tests for User Story 4

- [x] T025 [P] [US4] Integration assertion all MVP catalog keys present on combined run+explain flows in `metrics-pipeline.integration-spec.ts`

### Implementation for User Story 4

- [x] T026 [US4] Add `omittedMetricKeys` diagnostic when partial derivation occurs in collectors
- [x] T027 [US4] Update experiment/explain OpenAPI decorators to document `metrics` and `runId` fields

**Checkpoint**: User Story 4 complete

---

## Phase 7: User Story 5 — Metric Provenance Audit (P2)

**Goal**: Structured audit events for metric collection without sensitive payloads

**Independent Test**: Successful persist emits `metric_snapshot_persisted` with counts only

### Implementation for User Story 5

- [x] T028 [US5] Emit audit log events from `PersistMetricSnapshotUseCase` per contract observability section
- [x] T029 [P] [US5] Unit test audit payload excludes SQL/plan content in `persist-metric-snapshot.usecase.spec.ts`

**Checkpoint**: All user stories complete

---

## Phase 8: Polish & Cross-Cutting

- [x] T030 [P] Add metrics retention config to `src/config/configuration.ts` and env validation
- [x] T031 Update BACKLOG Metrics Pipeline checklist and spec status to Implementing → Done when complete
- [x] T032 Run full test suite and update `quickstart.md` if command paths differ

---

## Dependencies

```text
Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2)
                              ↘
Phase 2 → Phase 5 (US3)
Phase 3 + 4 → Phase 6 (US4)
Phase 2 → Phase 7 (US5)
All → Phase 8
```

## Parallel Opportunities

- T001, T002, T005 can run in parallel (Phase 1–2 setup)
- T006 and T007 collector implementations parallel after T005
- T013/T014 parallel with T017/T018 after Phase 2 checkpoint
- T030 config work parallel with US5 audit tasks

## Implementation Strategy

**MVP first**: Complete Phases 1–4 (US1 + US2) for inline metrics on every run/explain — unblocks Lab Shell metrics panel.

**Incremental**: Add history (US3) then contract hardening (US4) then audit (US5).
