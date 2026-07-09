# Tasks: Worker Queue Foundation

**Input**: Design documents from `/specs/012-worker-queue-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included (constitution requires unit + integration).

**Organization**: Tasks grouped by user story for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1–US4)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Shared types, config, and module skeleton

- [x] T001 Add shared job types in `src/shared/jobs/` (`job-status.enum.ts`, `job-type.enum.ts`, `job-failure-reason.enum.ts`, `background-job.ts`, `job-queue-payload.ts`, `index.ts`) and export from `src/shared/index.ts`
- [x] T002 [P] Add worker-queue / dataset-reset config keys in `src/config/configuration.ts` and `src/config/env.validation.ts`; document in `.env.example`
- [x] T003 Create `src/modules/worker-queue/worker-queue.module.ts` and register in `src/app.module.ts`

---

## Phase 2: Foundational

**Purpose**: Shared store, producer, dead-letter logging — blocks all user stories

**⚠️ CRITICAL**: No user story work until this phase completes

- [x] T004 Implement `JobStore` in `src/modules/worker-queue/infrastructure/job.store.ts` (Redis status + session index)
- [x] T005 [P] Unit tests in `src/modules/worker-queue/infrastructure/job.store.spec.ts`
- [x] T006 Implement `JobQueueProducer` in `src/modules/worker-queue/infrastructure/job-queue.producer.ts` (per-`JobType` queue, retry defaults, `QUEUE_UNAVAILABLE`)
- [x] T007 [P] Unit tests in `src/modules/worker-queue/infrastructure/job-queue.producer.spec.ts`
- [x] T008 Implement `DeadLetterLogger` in `src/modules/worker-queue/infrastructure/dead-letter.logger.ts` (`job_dead_lettered` structured logs/metrics)
- [x] T009 Export foundation providers from `WorkerQueueModule` for feature modules and workers

**Checkpoint**: Foundation ready — user stories can proceed

---

## Phase 3: User Story 1 — Heavy Work Leaves the Request Path (P1) 🎯 MVP

**Goal**: Shared enqueue + status so HTTP returns before work finishes

**Independent Test**: Enqueue a job via producer; `GET /jobs/:jobId` returns `queued` while worker has not completed

### Tests

- [x] T010 [P] [US1] Unit tests for `GetJobStatusUseCase` in `src/modules/worker-queue/application/get-job-status.usecase.spec.ts`

### Implementation

- [x] T011 [US1] Implement `GetJobStatusUseCase` in `src/modules/worker-queue/application/get-job-status.usecase.ts` (ownership checks)
- [x] T012 [US1] Add `GET /jobs/:jobId` in `src/modules/worker-queue/worker-queue.controller.ts` + DTO if needed
- [x] T013 [US1] Wire enqueue helper path: create JobStore row then `JobQueueProducer.enqueue` with no ambiguous half-created jobs

**Checkpoint**: Shared status API works for foundation jobs

---

## Phase 4: User Story 2 — Retry Then Dead Letter (P1)

**Goal**: Retryable failures retry; exhausted attempts dead-letter via logs/metrics

**Independent Test**: Controlled permanent failure exhausts attempts; status `failed` + `job_dead_lettered` log; transient failure succeeds on retry

### Tests

- [x] T014 [P] [US2] Unit tests for dead-letter + attempt accounting in `dead-letter.logger.spec.ts` and/or processor helper tests

### Implementation

- [x] T015 [US2] Apply per-queue retry/backoff from config in `JobQueueProducer` and worker processors
- [x] T016 [US2] On final failure, set `deadLetteredAt` on JobStore and emit `DeadLetterLogger` event
- [x] T017 [US2] Map non-retryable validation failures to immediate `failed` without endless retries

**Checkpoint**: Retry/DLQ behavior verifiable in unit tests

---

## Phase 5: User Story 3 — Dataset Reset & Benchmarks Share Foundation (P1)

**Goal**: Benchmark uses shared primitives; dataset reset always async enqueue + poll

**Independent Test**: `POST` reset returns `jobId`/`queued` within 2s; poll `GET /jobs/:id` to completion; benchmark enqueue still works via foundation

### Tests

- [x] T018 [P] [US3] Unit tests for async `ResetDatasetUseCase` enqueue path in `src/modules/dataset-loader/application/reset-dataset.usecase.spec.ts`
- [x] T019 [P] [US3] Update benchmark enqueue tests to use shared producer/store in `enqueue-benchmark.usecase.spec.ts`

### Implementation

- [x] T020 [US3] Migrate `BenchmarkQueueProducer` / `BenchmarkJobStore` usage to `JobQueueProducer` + `JobStore` in `src/modules/benchmark-runner/`
- [x] T021 [US3] Update `benchmark-worker.processor.ts` to read/write shared JobStore lifecycle
- [x] T022 [US3] Change `ResetDatasetUseCase` to enqueue-only (all tiers); return `202`-style result with `jobId`
- [x] T023 [US3] Add `src/workers/dataset-reset-worker.module.ts`, `dataset-reset-worker.processor.ts`, `src/dataset-reset-worker.main.ts`, and `dev:dataset-reset-worker` script in `package.json`
- [x] T024 [US3] Deprecate or thin-delegate `GET /datasets/reset/status` and `GET /benchmarks/:jobId` toward `GET /jobs/:jobId` per contracts
- [x] T025 [US3] Hook `CancelSessionJobsUseCase` from `TeardownExperimentSessionUseCase` in `src/modules/experiment-isolation/`
- [x] T026 [P] [US3] Implement `CancelSessionJobsUseCase` in `src/modules/worker-queue/application/cancel-session-jobs.usecase.ts` (+ spec)

**Checkpoint**: Both job types complete via workers; teardown cancels session jobs

---

## Phase 6: User Story 4 — Survive Queue Outages for Cache-Only Paths (P2)

**Goal**: Queue-required enqueue fails fast; non-queue features still work

**Independent Test**: With queue unavailable, enqueue returns `QUEUE_UNAVAILABLE` ≤2s; `GET /auth/me` (or equivalent) still succeeds

### Tests

- [x] T027 [P] [US4] Unit/integration coverage for enqueue failure mapping in producer/use-case specs

### Implementation

- [x] T028 [US4] Ensure feature UseCases that are cache-only do not import `JobQueueProducer`
- [x] T029 [US4] Fail closed on enqueue with `DomainError` / `QUEUE_UNAVAILABLE` and no orphan JobStore rows

**Checkpoint**: SC-004 behavior covered

---

## Phase 7: Polish

- [x] T030 [P] Integration test in `test/integration/worker-queue-foundation.integration-spec.ts` (reset enqueue + status; queue unavailable)
- [x] T031 [P] Update `README.md` / backlog status for Worker Queue Foundation; align `specs/012-worker-queue-foundation/quickstart.md` scripts
- [x] T032 Run unit test suite for touched modules and fix regressions

---

## Dependencies & Execution Order

```text
Phase 1 → Phase 2 → US1 → US2 → US3 → US4 → Polish
```

- US1 provides status API needed to validate US3
- US2 retry/DLQ should land before US3 workers finalize failure paths
- US4 is a hardening pass over enqueue paths from US1/US3
- Cancel-on-teardown is part of US3 (clarification: no learner cancel API)

### Parallel examples

- T002 ∥ T001 after types sketched
- T005 ∥ T004
- T007 ∥ T006
- T018 ∥ T019 after foundation + US1 status exist
- T026 can parallel T022 once JobStore session index exists

## Implementation Strategy

1. Complete Setup + Foundational
2. Ship US1 (shared status) as MVP slice
3. Add US2 retry/DLQ
4. Migrate benchmark + async reset (US3)
5. Harden outage behavior (US4)
6. Polish + backlog Done

## Notes

- [P] = different files, no blocking dependency
- Feature-development rule: implement **one task at a time** when running `/speckit-implement`
- Do not implement SQL Execution Queue here
