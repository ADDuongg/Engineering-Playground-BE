# Tasks: Benchmark Metrics

**Input**: Design documents from `/specs/014-benchmark-metrics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (constitution requires unit + integration).

**Organization**: Tasks grouped by user story for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Shared types and catalog extensions for benchmark metrics

- [x] T001 Extend `MetricRunType` with `'benchmark'` in `src/shared/metrics/metric-run-context.ts`; add optional `jobId` and `profile` fields to `MetricRunContext`; export updates from `src/shared/metrics/index.ts`
- [x] T002 [P] Extend `BenchmarkJobStatusResult` in `src/shared/benchmark/benchmark-job-status-result.ts` with optional `metricsStatus`, `metrics`, and `runId`; add shared response types for metrics-by-job / history in `src/shared/metrics/benchmark-metric-responses.ts` (or under `src/shared/benchmark/`) and export them
- [x] T003 [P] Add benchmark catalog entries (`latency_avg_ms`, `latency_p95_ms`, `latency_p99_ms`, `achieved_rps`, `throughput_rps`, `error_rate_pct`) and `MetricSource` value `'benchmark'` in `src/modules/metrics-pipeline/domain/database-metrics.catalog.ts`

---

## Phase 2: Foundational

**Purpose**: Schema + parser + persistence plumbing — blocks all user stories

**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T004 Add migration `src/database/migrations/<timestamp>-ExtendMetricSnapshotsForBenchmark.ts` adding nullable `job_id` (unique partial index) and `profile` jsonb to `metric_snapshots`; register migration in `src/database/platform/data-source.ts` if required by project convention
- [x] T005 Update `MetricSnapshotEntity` in `src/modules/metrics-pipeline/infrastructure/metric-snapshot.entity.ts` and `MetricSnapshotRepository` in `src/modules/metrics-pipeline/infrastructure/metric-snapshot.repository.ts` to save/load `jobId` + `profile`, support `findByJobId`, and filter history by `runType === 'benchmark'`
- [x] T006 [P] Implement `K6SummaryParser` in `src/modules/metrics-pipeline/infrastructure/k6-summary.parser.ts` mapping k6 summary → six catalog metrics (error rate ×100; throughput = rate × (1 − failed rate)); unit tests in `src/modules/metrics-pipeline/infrastructure/k6-summary.parser.spec.ts`
- [x] T007 Extend `PersistMetricSnapshotUseCase` / repository save path in `src/modules/metrics-pipeline/application/persist-metric-snapshot.usecase.ts` to accept and persist `jobId` + `profile` from context; make `jobId` inserts idempotent (skip duplicate)

**Checkpoint**: Catalog, schema, and parser ready; can persist a benchmark snapshot in unit tests

---

## Phase 3: User Story 1 — Chart-Ready Metrics After Completed Benchmark (P1) 🎯 MVP

**Goal**: Auto-collect on `benchmark.finished` (completed + summary); persist snapshot; embed metrics on completed status

**Independent Test**: Complete a benchmark → status shows `metricsStatus: 'ready'` and six Metric Contract keys; failed parse → `unavailable` without failing the job

### Tests

- [x] T008 [P] [US1] Unit tests for `CollectBenchmarkMetricsUseCase` in `src/modules/metrics-pipeline/application/collect-benchmark-metrics.usecase.spec.ts` (happy path, malformed summary → unavailable, skip non-completed, idempotent jobId)
- [x] T009 [P] [US1] Unit tests for `BenchmarkFinishedListener` in `src/modules/metrics-pipeline/listeners/benchmark-finished.listener.spec.ts` (invokes collect on completed event; ignores failed)

### Implementation

- [x] T010 [US1] Implement `CollectBenchmarkMetricsUseCase` in `src/modules/metrics-pipeline/application/collect-benchmark-metrics.usecase.ts`: parse summary → catalog metrics → persist → update job `payloadSummary` (`metrics`, `runId`, `metricsStatus`); on failure set `metricsStatus: 'unavailable'` and emit `benchmark_metrics_collected` logs; no re-collect API
- [x] T011 [US1] Implement `BenchmarkFinishedListener` in `src/modules/metrics-pipeline/listeners/benchmark-finished.listener.ts` subscribed to `BENCHMARK_FINISHED_EVENT`; register listener + use case in `src/modules/metrics-pipeline/metrics-pipeline.module.ts` (ensure `EventEmitterModule` / `WorkerQueueModule`/`JobStore` imports as needed)
- [x] T012 [US1] Update `GetBenchmarkStatusUseCase` in `src/modules/benchmark-runner/application/get-benchmark-status.usecase.ts` to return embedded `metrics` / `metricsStatus` / `runId` from `payloadSummary`; set `pending` for non-terminal statuses; update `src/modules/benchmark-runner/application/get-benchmark-status.usecase.spec.ts`

**Checkpoint**: MVP — auto-collect + status embed works (SC-001 partial)

---

## Phase 4: User Story 2 — Compare Benchmark Runs Over Time (P1)

**Goal**: Persist history with profile/jobId; retrieve chronological benchmark snapshots for a session

**Independent Test**: Two completed benchmarks in one session → history returns ≥ 2 snapshots with distinguishable metrics and profiles

### Tests

- [x] T013 [P] [US2] Unit tests for benchmark history retrieval (filter `runType: benchmark`, ordering, retention) in `src/modules/metrics-pipeline/application/get-benchmark-metric-history.usecase.spec.ts` (or extended existing history spec)

### Implementation

- [x] T014 [US2] Implement `GetBenchmarkMetricHistoryUseCase` in `src/modules/metrics-pipeline/application/get-benchmark-metric-history.usecase.ts` returning `BenchmarkMetricHistoryResponse` (jobId, profile, metrics, dataset)
- [x] T015 [US2] Add DTO `src/modules/metrics-pipeline/dto/get-benchmark-metric-history.dto.ts` and `GET /benchmarks/metrics/history` route (controller ownership: prefer `BenchmarkRunnerController` or dedicated metrics routes in `metrics-pipeline.controller.ts` under `/benchmarks` path via module wiring — follow plan: expose on `/benchmarks/metrics/history`)
- [x] T016 [US2] Ensure `CollectBenchmarkMetricsUseCase` always stores `profile` + `jobId` + dataset from finished event/job payload so history entries are comparison-ready

**Checkpoint**: SC-002 history comparison path works

---

## Phase 5: User Story 3 — Stable Benchmark Metrics API (P1)

**Goal**: Dedicated metrics-by-job endpoint matching embedded status values; clear pending/unavailable states

**Independent Test**: After completion, `GET /benchmarks/:jobId/metrics` matches status `metrics[]`; running job returns `pending`; collection failure returns `unavailable`

### Tests

- [x] T017 [P] [US3] Unit tests for `GetBenchmarkMetricsUseCase` in `src/modules/metrics-pipeline/application/get-benchmark-metrics.usecase.spec.ts` (ready / pending / unavailable / forbidden / not found)

### Implementation

- [x] T018 [US3] Implement `GetBenchmarkMetricsUseCase` in `src/modules/metrics-pipeline/application/get-benchmark-metrics.usecase.ts` (load job, ownership check, load snapshot by jobId, map `BenchmarkMetricsByJobResponse`)
- [x] T019 [US3] Add DTO `src/modules/metrics-pipeline/dto/get-benchmark-metrics.dto.ts` and `GET /benchmarks/:jobId/metrics` on `src/modules/benchmark-runner/benchmark-runner.controller.ts` (or metrics controller with same base path); wire module exports/imports
- [x] T020 [US3] Assert parity helper/test: embedded status metrics equal metrics-by-job for same completed run (unit or integration assertion for FR-017)

**Checkpoint**: Dual-path API complete (SC-001 full, SC-004)

---

## Phase 6: User Story 4 — Operators Trace Provenance (P2)

**Goal**: Observability distinguishes success vs collection failure; no sensitive SQL in logs

**Independent Test**: Successful collect logs `benchmark_metrics_collected` phase `completed` with jobId/metricCount; failure logs `failed` with reason; no SQL text

### Tests

- [x] T021 [P] [US4] Unit test log/event payloads in `collect-benchmark-metrics.usecase.spec.ts` (completed vs failed vs skipped; fields present; SQL absent)

### Implementation

- [x] T022 [US4] Finalize structured logging in `CollectBenchmarkMetricsUseCase` / listener per contract observability section; ensure skip path for non-completed events emits `phase: 'skipped'`

**Checkpoint**: Ops can diagnose “completed but metrics unavailable”

---

## Phase 7: Polish & Cross-Cutting

- [x] T023 [P] Integration test `test/integration/benchmark-metrics.integration-spec.ts` covering quickstart scenarios 1–4 (auto-collect + embed, metrics-by-job parity, history ≥2, forbidden)
- [x] T024 [P] Update `specs/014-benchmark-metrics/quickstart.md` if routes/scripts differ; update `docs/product/BACKLOG.md` Benchmark Metrics status to `Implementing` then `Done` when complete; note README only if new env vars added
- [x] T025 Run unit + integration suites for touched modules and fix regressions

---

## Dependencies & Execution Order

```text
Phase 1 → Phase 2 → US1 (MVP) → US2 → US3 → US4 → Polish
```

- US1 is MVP: auto-collect + status embed
- US2 (history) builds on persisted snapshots from US1
- US3 (metrics-by-job) builds on snapshots + ownership patterns
- US4 tightens observability already started in US1

### Parallel examples

- T002 ∥ T003 after T001 sketched
- T006 ∥ T004/T005 (parser vs migration)
- T008 ∥ T009 (different files)
- T013 ∥ T017 in later phases when foundations exist
- T023 ∥ T024 in Polish

## Implementation Strategy

1. Complete Setup + Foundational (T001–T007)
2. Ship US1 (T008–T012) as MVP async collect + status embed
3. Add history (US2)
4. Add dedicated metrics-by-job (US3)
5. Harden observability (US4)
6. Polish: integration tests, backlog, regression pass

## Notes

- [P] = different files, no blocking dependency
- Feature-development rule: implement **ONE TASK ONLY** when running `/speckit-implement`
- Do not expose raw `k6Summary` on public responses
- No re-collect/repair endpoint (FR-018)
- Reuse Metrics Pipeline retention (`metrics.retentionLimit`, default 50)
