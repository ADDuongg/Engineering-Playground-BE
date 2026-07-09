# Implementation Plan: Benchmark Runner

**Branch**: `011-benchmark-runner` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-benchmark-runner/spec.md`

## Summary

Add a `benchmark-runner` NestJS module that accepts benchmark job submissions over HTTP, enqueues them on BullMQ, and processes them in a dedicated worker process. Workers execute k6 load tests against a session-scoped internal benchmark target derived from the learner's experiment session and SQL query. Job lifecycle (queued → running → completed → failed) is persisted in Redis with timestamps. HTTP returns immediately with a job identifier. Rate limits apply at enqueue via existing `RateLimitService`. Raw completion signals integrate with Metrics Pipeline; aggregated benchmark metrics remain in the Benchmark Metrics feature.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, BullMQ, ioredis (existing), k6 (external binary), Jest — consumes `ExperimentIsolationModule`, `ExperimentRunnerModule`, `RateLimitModule`, `MetricsPipelineModule`

**Storage**: Redis for BullMQ queues and benchmark job status snapshots; Platform DB optional later via Benchmark Metrics — no playground schema changes for job metadata in MVP

**Testing**: Unit tests for enqueue use case, lifecycle store, profile validation; integration tests with mocked k6 runner; worker processor tests with in-memory queue

**Target Platform**: NestJS API (`src/modules/benchmark-runner/`) + separate worker entry (`src/workers/benchmark.worker.ts` or `nest start --entryFile benchmark-worker`)

**Performance Goals**: Enqueue API responds within 2s (spec SC-001); worker concurrency bounded by config aligned with playground pool

**Constraints**: Never execute k6 inside HTTP handler; fail closed when queue unavailable; job ownership enforced by user/session; targets scoped to playground session only

**Scale/Scope**: Database Track MVP; RPS tiers 100/500/1000/5000; durations 10/30/60s; commerce dataset labs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Shared `BenchmarkJob`, `BenchmarkProfile`, status enum in `src/shared/benchmark/`; DTOs validated; exported via `@db-play/types`
- [x] **Feature-first backend**: `BenchmarkRunnerController` → `EnqueueBenchmarkUseCase` / `GetBenchmarkStatusUseCase` → `BenchmarkJobRepository` + BullMQ producer; worker → `RunBenchmarkJobProcessor` → `K6BenchmarkExecutor`
- [x] **TypeScript strict**: Typed job payloads, lifecycle transitions; no unjustified `any`
- [x] **Testing**: Unit tests for validation and lifecycle; integration tests for enqueue/status/rate-limit; worker test with stub executor
- [x] **Learning UX**: Actionable errors for invalid profile, missing session, queue unavailable, failed runs with reason categories
- [x] **Platform vs Playground**: Load applied via playground/experiment path; job metadata in Redis/queue, not mixed with learner SQL result tables
- [x] **Simplicity**: Benchmark-specific BullMQ queue first; Worker Queue Foundation generalizes later

**Post-design note**: Introduces first BullMQ queue in the codebase (benchmark-only). Dataset reset and SQL Execution Queue migrate when Worker Queue Foundation lands. k6 invoked as subprocess with generated script — containerized k6 deferred to production infra.

## Project Structure

### Documentation (this feature)

```text
specs/011-benchmark-runner/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── benchmark-runner-service.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── benchmark-runner/
│       ├── benchmark-runner.module.ts
│       ├── benchmark-runner.controller.ts
│       ├── dto/
│       │   ├── enqueue-benchmark.dto.ts
│       │   └── get-benchmark-status.dto.ts
│       ├── application/
│       │   ├── enqueue-benchmark.usecase.ts
│       │   ├── enqueue-benchmark.usecase.spec.ts
│       │   ├── get-benchmark-status.usecase.ts
│       │   └── get-benchmark-status.usecase.spec.ts
│       └── infrastructure/
│           ├── benchmark-job.store.ts
│           ├── benchmark-job.store.spec.ts
│           ├── benchmark-queue.producer.ts
│           ├── benchmark-profile.validator.ts
│           └── k6-benchmark.executor.ts
├── workers/
│   ├── benchmark-worker.module.ts
│   └── benchmark-worker.processor.ts
├── shared/
│   └── benchmark/
│       ├── benchmark-job-status.enum.ts
│       ├── benchmark-profile.ts
│       ├── benchmark-job.ts
│       └── index.ts

test/
└── integration/
    └── benchmark-runner.integration-spec.ts
```

**Structure Decision**: Separate `benchmark-runner` module for HTTP + enqueue orchestration and a `workers/` entry for BullMQ consumption, matching ENGINEERING_GUIDE §14. k6 execution isolated in `K6BenchmarkExecutor` infrastructure adapter so tests stub load generation.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| First BullMQ adoption before Worker Queue Foundation | BACKLOG orders Benchmark Runner before generalized worker infra; constitution forbids sync benchmark in HTTP | In-process async only rejected: no cross-instance worker scaling, no retry/DLQ baseline for long k6 runs |
| k6 subprocess (not HTTP mock load) | Labs teach real load-test behavior; SYSTEM_DESIGN specifies k6 | Loop calling `RunExperimentSqlUseCase` from worker rejected: not representative RPS control, bypasses k6 metric output format expected by Benchmark Metrics |
| Redis job snapshot + BullMQ job | Status polling must work if worker restarts; learners need lifecycle independent of queue message TTL | BullMQ state alone rejected: completed job removal loses queryable history for status endpoint until Benchmark Metrics persists |
