# Tasks: Benchmark Runner

**Input**: Design documents from `/specs/011-benchmark-runner/`

## Phase 1: Setup

- [x] T001 Add `bullmq` dependency and benchmark config keys in `src/config/configuration.ts` and `src/config/env.validation.ts`
- [x] T002 [P] Add shared benchmark types in `src/shared/benchmark/` and export from `src/shared/index.ts`
- [x] T003 Create `src/modules/benchmark-runner/benchmark-runner.module.ts` and register in `src/app.module.ts`

## Phase 2: Foundational

- [x] T004 Implement `BenchmarkJobStore` in `src/modules/benchmark-runner/infrastructure/benchmark-job.store.ts`
- [x] T005 [P] Unit tests in `src/modules/benchmark-runner/infrastructure/benchmark-job.store.spec.ts`
- [x] T006 Implement `BenchmarkProfileValidator` in `src/modules/benchmark-runner/infrastructure/benchmark-profile.validator.ts`
- [x] T007 Implement `BenchmarkQueueProducer` in `src/modules/benchmark-runner/infrastructure/benchmark-queue.producer.ts`
- [x] T008 Create worker entry `src/workers/benchmark-worker.module.ts` and `benchmark-worker.processor.ts`; add `dev:benchmark-worker` script to `package.json`

## Phase 3: User Story 1 — Non-blocking benchmark submission (P1)

**Goal**: Learners enqueue benchmarks and receive a job ID without waiting for k6 completion.

**Independent test**: POST `/benchmarks` returns within 2s with `jobId` while k6 still runs in worker.

- [x] T009 [US1] Implement `EnqueueBenchmarkUseCase` in `src/modules/benchmark-runner/application/enqueue-benchmark.usecase.ts`
- [x] T010 [US1] Wire rate limit (`RateLimitOperation.BENCHMARK_ENQUEUE`) and session validation in enqueue use case
- [x] T011 [P] [US1] Unit tests in `src/modules/benchmark-runner/application/enqueue-benchmark.usecase.spec.ts`
- [x] T012 [US1] Add `POST /benchmarks` in `src/modules/benchmark-runner/benchmark-runner.controller.ts`

## Phase 4: User Story 2 — Standard load profiles (P1)

**Goal**: Supported RPS tiers and durations validated before enqueue.

**Independent test**: Each allowed profile succeeds; invalid RPS/duration returns `VALIDATION_ERROR`.

- [x] T013 [US2] Enforce allowlisted profiles in `BenchmarkProfileValidator` with config-driven tiers
- [x] T014 [P] [US2] Unit tests for profile validation edge cases in `benchmark-profile.validator.spec.ts`

## Phase 5: User Story 3 — Lifecycle tracking (P1)

**Goal**: Jobs transition queued → running → completed/failed with timestamps; status queryable by owner.

**Independent test**: Poll GET `/benchmarks/:jobId` through full lifecycle.

- [x] T015 [US3] Implement `K6BenchmarkExecutor` in `src/modules/benchmark-runner/infrastructure/k6-benchmark.executor.ts`
- [x] T016 [US3] Implement lifecycle transitions in `benchmark-worker.processor.ts`
- [x] T017 [US3] Implement `GetBenchmarkStatusUseCase` in `src/modules/benchmark-runner/application/get-benchmark-status.usecase.ts`
- [x] T018 [US3] Add `GET /benchmarks/:jobId` to controller with ownership checks
- [x] T019 [P] [US3] Unit tests for status use case and processor lifecycle in `get-benchmark-status.usecase.spec.ts`

## Phase 6: User Story 4 — Load isolation (P2)

**Goal**: Benchmarks run in worker path; bounded concurrency; playground-scoped targets.

**Independent test**: Concurrent API traffic remains healthy during max-tier benchmark (integration test stub).

- [x] T020 [US4] Enforce `BENCHMARK_MAX_INFLIGHT_PER_SESSION` in enqueue use case
- [x] T021 [US4] Configure worker concurrency and job timeout in worker module
- [x] T022 [P] [US4] Integration test in `test/integration/benchmark-runner.integration-spec.ts`

## Phase 7: Polish

- [x] T023 Emit `BenchmarkFinished` event for Metrics Pipeline handoff
- [x] T024 Update backlog status and run full test suite

## Dependencies

```text
Phase 1 → Phase 2 → US1/US2 (parallel) → US3 → US4 → Polish
```

## Parallel examples

- T002 ∥ T001 after T001 config keys defined
- T005 ∥ T004
- T011 ∥ T012 after T009
- T014 ∥ T013
