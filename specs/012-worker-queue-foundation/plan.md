# Implementation Plan: Worker Queue Foundation

**Branch**: `012-worker-queue-foundation` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-worker-queue-foundation/spec.md`

## Summary

Extract shared BullMQ worker primitives (enqueue, job status store, retry/dead-letter conventions, observability) into a `worker-queue` foundation module. Keep **one queue per job type** (`benchmark-jobs`, `dataset-reset-jobs`). Migrate Benchmark Runner onto the shared producer/store. Convert Dataset Reset to **always-async** enqueue + poll via shared `GET /jobs/:jobId`. Cancel jobs only on session teardown (no learner cancel API). Dead-letter inspection is structured logs + metrics only.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, BullMQ, ioredis (existing), Jest — consumes/refactors `BenchmarkRunnerModule`, `DatasetLoaderModule`, `ExperimentIsolationModule`

**Storage**: Redis for BullMQ queues, shared job status snapshots, and dead-letter markers; no Platform DB migration for MVP job metadata

**Testing**: Unit tests for job store, producer, retry/dead-letter transitions, get-job-status ownership; integration tests for async dataset reset enqueue + shared status; benchmark regression that still enqueues via foundation

**Target Platform**: NestJS API (`src/modules/worker-queue/`) + worker entries under `src/workers/` (benchmark + dataset-reset)

**Project Type**: Backend web-service (NestJS monorepo module)

**Performance Goals**: Enqueue APIs respond within 2s (SC-001); queue-unavailable fails within 2s (SC-004); per-queue concurrency bounded by config

**Constraints**: Never run heavy work in HTTP handlers; fail closed when enqueue required and Redis/queue down; UseCases for cache-only paths must not hard-depend on queue availability; ownership enforced on shared status endpoint

**Scale/Scope**: Database Track MVP — job types `benchmark` and `dataset-reset`; SQL Execution Queue consumes foundation later

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Shared `BackgroundJob`, `JobType`, status/failure enums in `src/shared/jobs/`; exported via `@db-play/types`
- [x] **Feature-first backend**: `WorkerQueueController` (status only) → `GetJobStatusUseCase` → `JobStore`; feature UseCases enqueue via `JobQueueProducer`; workers → typed processors → feature executors
- [x] **TypeScript strict**: Typed payloads per job type; no unjustified `any`
- [x] **Testing**: Unit + integration planned; teardown cancel covered
- [x] **Learning UX**: Actionable `QUEUE_UNAVAILABLE`, categorized failures on status poll
- [x] **Platform vs Playground**: Job metadata in Redis/queue; reset/benchmark still target playground only
- [x] **Simplicity**: Shared libraries + per-type queues; no multi-type mega-queue; no admin dead-letter API

**Post-design note**: Generalizes existing benchmark-only BullMQ path. Dataset reset loses sync fast-path (clarification). Existing `GET /benchmarks/:jobId` and `GET /datasets/reset/status` migrate to / are superseded by `GET /jobs/:jobId` (benchmark route may thin-delegate or be removed in tasks).

## Project Structure

### Documentation (this feature)

```text
specs/012-worker-queue-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── worker-queue-service.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   ├── worker-queue/
│   │   ├── worker-queue.module.ts
│   │   ├── worker-queue.controller.ts          # GET /jobs/:jobId
│   │   ├── application/
│   │   │   ├── get-job-status.usecase.ts
│   │   │   ├── get-job-status.usecase.spec.ts
│   │   │   └── cancel-session-jobs.usecase.ts  # internal: session teardown
│   │   └── infrastructure/
│   │       ├── job.store.ts
│   │       ├── job.store.spec.ts
│   │       ├── job-queue.producer.ts
│   │       ├── job-queue.producer.spec.ts
│   │       └── dead-letter.logger.ts
│   ├── benchmark-runner/                       # migrate to JobQueueProducer + JobStore
│   ├── dataset-loader/                         # ResetDatasetUseCase → enqueue only
│   └── experiment-isolation/                   # teardown hooks CancelSessionJobs
├── workers/
│   ├── benchmark-worker.module.ts              # use shared connection/retry defaults
│   ├── benchmark-worker.processor.ts
│   ├── dataset-reset-worker.module.ts
│   └── dataset-reset-worker.processor.ts
├── shared/
│   └── jobs/
│       ├── job-status.enum.ts
│       ├── job-type.enum.ts
│       ├── job-failure-reason.enum.ts
│       ├── background-job.ts
│       ├── job-queue-payload.ts
│       └── index.ts
└── benchmark-worker.main.ts
└── dataset-reset-worker.main.ts                # new entry + package.json script

test/
└── integration/
    └── worker-queue-foundation.integration-spec.ts
```

**Structure Decision**: New `worker-queue` feature module owns shared status API and infrastructure primitives. Feature modules keep enqueue HTTP routes and domain executors. Separate worker processes/queues per job type.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Shared module + per-type queues | Isolation of k6 vs reset concurrency (clarification Q3) | Single multi-type queue couples worker pools and blocks SQL queue later |
| Async-only dataset reset | Clarification Q1; ENGINEERING_GUIDE §14 | Keeping sync tiers duplicates two execution models |
