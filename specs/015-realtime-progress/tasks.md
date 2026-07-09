# Tasks: Realtime Progress

**Input**: Design documents from `/specs/015-realtime-progress/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (constitution requires unit + integration).

**Organization**: Tasks grouped by user story for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Shared types and config for benchmark progress

- [x] T001 Add `BenchmarkProgressSnapshot`, `PartialMetric`, and related types in `src/shared/benchmark/benchmark-progress-snapshot.ts`; export from `src/shared/benchmark/index.ts`
- [x] T002 [P] Add Redis channel/key helpers and progress event constants in `src/shared/benchmark/benchmark-progress.events.ts`; export from `src/shared/benchmark/index.ts`
- [x] T003 [P] Add config for progress cadence/TTL (`benchmark.progressIntervalMs`, progress key TTL) in `src/config/configuration.ts` and `src/config/env.validation.ts`; document in `.env.example` if new env vars are introduced

---

## Phase 2: Foundational

**Purpose**: Redis progress store + k6 interim observations — blocks all user stories

**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T004 Implement `BenchmarkProgressStore` in `src/modules/benchmark-runner/infrastructure/benchmark-progress.store.ts` (get/set latest snapshot, publish on channel, TTL); unit tests in `src/modules/benchmark-runner/infrastructure/benchmark-progress.store.spec.ts`
- [x] T005 [P] Implement `K6ProgressMapper` in `src/modules/benchmark-runner/infrastructure/k6-progress.mapper.ts` mapping interim k6 aggregates → `currentRps` + provisional `partialMetrics` (`achieved_rps`, optional `latency_avg_ms` / `error_rate_pct`); unit tests in `src/modules/benchmark-runner/infrastructure/k6-progress.mapper.spec.ts`
- [x] T006 Extend `K6BenchmarkExecutor` in `src/modules/benchmark-runner/infrastructure/k6-benchmark.executor.ts` to accept throttled `onProgress` callback (~1 Hz) fed by interim k6 output (e.g. `--out json` tail); keep end-of-run summary export for Benchmark Metrics
- [x] T007 Wire `BenchmarkProgressStore` into `BenchmarkRunnerModule` / worker module providers so API and `benchmark-worker` can both use it

**Checkpoint**: Can write/read/publish a progress snapshot and produce interim observations from k6 in unit tests

---

## Phase 3: User Story 1 — Live Progress Without Freezing the Lab (P1) 🎯 MVP

**Goal**: SSE stream with phase, elapsed time, and current RPS while queued/running; ownership enforced; no status polling for progress

**Independent Test**: Start a multi-second benchmark; open SSE; receive successive progress events with phase/elapsed and RPS after load starts

### Tests

- [x] T008 [P] [US1] Unit tests for `ObserveBenchmarkProgressUseCase` in `src/modules/benchmark-runner/application/observe-benchmark-progress.usecase.spec.ts` (ownership deny, emit latest, queued seed without RPS)
- [x] T009 [P] [US1] Unit tests for worker progress publish hooks (markRunning / onProgress) covering phase transitions

### Implementation

- [x] T010 [US1] Implement `ObserveBenchmarkProgressUseCase` in `src/modules/benchmark-runner/application/observe-benchmark-progress.usecase.ts`: ownership check, emit latest or status-seeded snapshot, subscribe Redis channel, cleanup on disconnect
- [x] T011 [US1] Add DTO `src/modules/benchmark-runner/dto/observe-benchmark-progress.dto.ts` and SSE route `GET /benchmarks/:jobId/progress` on `src/modules/benchmark-runner/benchmark-runner.controller.ts`; bypass response envelope for SSE
- [x] T012 [US1] Update `src/workers/benchmark-worker.processor.ts` (and enqueue path as needed) to publish `queued`/`running` snapshots with elapsed basis; throttle `onProgress` publishes with `currentRps` when available
- [x] T013 [US1] Ensure enqueue path can seed/publish initial `queued` progress in `src/modules/benchmark-runner/application/enqueue-benchmark.usecase.ts` (or equivalent) so SSE works before worker pickup

**Checkpoint**: MVP — live SSE progress with phase/elapsed/RPS (SC-001 partial)

---

## Phase 4: User Story 2 — Partial Metrics Preview During Run (P1)

**Goal**: Provisional latency/error alongside current RPS; clearly provisional; not treated as finals

**Independent Test**: While running with observations, SSE `partialMetrics` includes provisional catalog fields; after completion finals still come from Benchmark Metrics only

### Tests

- [x] T014 [P] [US2] Extend mapper/use-case specs to assert provisional subset only (no inventing zeros; full six-metric set not required mid-run) in `k6-progress.mapper.spec.ts` / `observe-benchmark-progress.usecase.spec.ts`

### Implementation

- [x] T015 [US2] Ensure worker `onProgress` path always sets `provisional: true` and maps partial metrics via `K6ProgressMapper` into snapshot `partialMetrics` in `benchmark-worker.processor.ts`
- [x] T016 [US2] Document/assert contract: progress payloads never include final Metric Contract array; omit unmeasured fields (FR-003/FR-012) in shared types + use case validation

**Checkpoint**: Partial preview present and marked provisional (SC-004)

---

## Phase 5: User Story 3 — Disconnect / Completion Recovery (P1)

**Goal**: Reconnect resumes from latest or status-seeded snapshot; terminal closes stream without finals; subscribe-after-completion does not hang

**Independent Test**: Disconnect mid-run and reconnect ≤3s; complete job and verify `terminal` then status/metrics for finals

### Tests

- [x] T017 [P] [US3] Unit tests for reconnect seed (missing Redis → JobStore phase/elapsed), terminal emit+close, subscribe-after-completion in `observe-benchmark-progress.usecase.spec.ts`

### Implementation

- [x] T018 [US3] Finalize reconnect logic in `ObserveBenchmarkProgressUseCase`: latest snapshot OR status seed OR immediate terminal; never invent RPS/partial on seed
- [x] T019 [US3] On job completed/failed in `benchmark-worker.processor.ts`, publish `terminal: true` snapshot (no finals) then stop progress publishes; ensure SSE closes on `terminal` event
- [x] T020 [US3] Add structured logs `benchmark_progress_observe_start/end` and `benchmark_progress_published` per contract observability (no SQL text)

**Checkpoint**: SC-002 / SC-003 reconnect + terminal handoff

---

## Phase 6: User Story 4 — Avoid Progress-Induced API Overload (P2)

**Goal**: Bounded publish cadence; observer cleanup; no progress-via-status-polling

**Independent Test**: Concurrent observe sessions stay within ~1 Hz publishes; disconnect unsubscribes Redis; status API not used as progress mechanism

### Tests

- [x] T021 [P] [US4] Unit tests for publish throttle and unsubscribe/cleanup in `benchmark-progress.store.spec.ts` / observe use case spec

### Implementation

- [x] T022 [US4] Enforce `benchmark.progressIntervalMs` throttle in worker publish path; drop faster ticks
- [x] T023 [US4] Ensure SSE disconnect unsubscribes Redis channel and releases observer resources in `ObserveBenchmarkProgressUseCase`

**Checkpoint**: SC-005 bounded delivery

---

## Phase 7: Polish & Cross-Cutting

- [x] T024 [P] Integration test `test/integration/realtime-progress.integration-spec.ts` covering quickstart scenarios 1–6 (live progress, reconnect, terminal handoff, after-completion, forbidden, queued)
- [x] T025 [P] Update `specs/015-realtime-progress/quickstart.md` if routes/scripts differ; set `docs/product/BACKLOG.md` Realtime Progress to `Implementing` then `Done` when complete; note README only if new env vars added
- [x] T026 Run unit + integration suites for touched modules and fix regressions

---

## Dependencies & Execution Order

```text
Phase 1 → Phase 2 → US1 (MVP) → US2 → US3 → US4 → Polish
```

- US1 is MVP: SSE + phase/elapsed/RPS
- US2 builds on interim mapper + publish path
- US3 hardens reconnect/terminal on the same use case
- US4 tightens throttle/cleanup already started in foundations

### Parallel examples

- T002 ∥ T003 after T001 sketched
- T005 ∥ T004 (mapper vs store)
- T008 ∥ T009 (different files)
- T014 ∥ T017 in later phases when foundations exist
- T024 ∥ T025 in Polish

## Implementation Strategy

1. Complete Setup + Foundational (T001–T007)
2. Ship US1 (T008–T013) as MVP SSE progress
3. Add partial metrics preview (US2)
4. Harden reconnect/terminal (US3)
5. Bound cadence + cleanup (US4)
6. Polish: integration tests, backlog, regression pass

## Notes

- [P] = different files, no blocking dependency
- Feature-development rule: implement **ONE TASK ONLY** when running `/speckit-implement`
- Push-only: do not add progress-via-polling fallback
- No Platform DB persistence of progress ticks
- Terminal stream must not embed final metrics (Benchmark Metrics owns finals)
- First SSE endpoint — exclude from response envelope interceptor
