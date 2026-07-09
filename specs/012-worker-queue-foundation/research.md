# Research: Worker Queue Foundation

**Feature**: 012-worker-queue-foundation | **Date**: 2026-07-09

## Decision 1: Shared primitives vs new queue product

**Decision**: Extract shared NestJS infrastructure (`JobQueueProducer`, `JobStore`, retry/dead-letter logging, Redis connection helpers) used by per-type BullMQ queues. Do not introduce a second queue product.

**Rationale**: Benchmark Runner already proved BullMQ + Redis. Spec requires generalizing that path (FR-001, FR-009) without inventing a parallel stack. ENGINEERING_GUIDE §14–15: heavy work on workers; UseCases must not hard-depend on Redis for cache-only paths.

**Alternatives considered**:
- Delay foundation and keep ad-hoc producers: blocks SQL Execution Queue and duplicates reset wiring.
- Nest `@nestjs/bullmq` module wrappers only: still need shared job status model and ownership checks; thin wrappers alone do not meet FR-006/FR-007.

## Decision 2: Queue topology

**Decision**: Separate BullMQ queue per job type (`benchmark-jobs`, `dataset-reset-jobs`) with shared libraries (clarification Session 2026-07-09).

**Rationale**: Isolates k6 load from dataset reset; allows independent concurrency/timeout config; SQL Execution Queue can add `sql-execution-jobs` later without sharing a worker pool.

**Alternatives considered**:
- Single multi-type queue: simpler ops, but couples concurrency and complicates backpressure.
- Interactive vs heavy pools only: still mixes unrelated job types in one pool.

## Decision 3: Job status storage

**Decision**: Unified Redis job snapshot store keyed by `job:{id}` (or `jobs:status:{id}`) with TTL; payload includes `jobType`, owner, lifecycle, attempts, failure fields. BullMQ holds execution payload; status is queryable after queue job cleanup.

**Rationale**: Shared `GET /jobs/:jobId` (clarification) needs one store. Mirrors BenchmarkJobStore pattern; avoids Platform DB until a later history feature.

**Alternatives considered**:
- Keep separate Redis key namespaces per feature without unified read API: forces duplicate status endpoints (rejected in clarification).
- Platform DB table now: out of scope; adds migration without learner history UI.

## Decision 4: Dataset reset becomes always-async

**Decision**: `POST …/datasets/reset` (or existing reset route) always enqueues; returns `jobId` + `queued`; learners poll `GET /jobs/:jobId`. Remove sync completion for small tiers (clarification).

**Rationale**: One execution model; aligns with FR-008 and ENGINEERING_GUIDE §14. Existing `GET /datasets/reset/status` can be deprecated in favor of shared job status (or thin-delegate during migration).

**Alternatives considered**:
- Sync for 100k / async for 1m–10m: dual paths increase complexity and contradict clarification B.
- Hybrid wait-then-jobId: ambiguous contracts and harder tests.

## Decision 5: Retry and dead-letter

**Decision**: Configurable per-queue `attempts` + exponential/fixed backoff via BullMQ `defaultJobOptions`. On final failure, mark job `failed`, write dead-letter structured log/metric event (`job_dead_lettered`) with jobType, jobId, failureCategory, attemptCount, sessionId/userId when present. No admin HTTP API (clarification).

**Rationale**: Meets FR-004/FR-005 and SC-003 without new operator UI. `removeOnFail: false` (or explicit DLQ list key) keeps failed BullMQ jobs inspectable in Redis if needed; primary operator surface is logs/metrics.

**Alternatives considered**:
- Admin GET dead-letter API: deferred (out of scope).
- Infinite retries: risks resource exhaustion.

## Decision 6: Cancellation

**Decision**: No learner cancel endpoint. `TeardownExperimentSessionUseCase` (or equivalent) invokes `CancelSessionJobsUseCase` to mark queued/running jobs `cancelled` and remove/ignore queue jobs for that `sessionId` (clarification).

**Rationale**: Prevents orphaned work after session end; keeps MVP surface small.

**Alternatives considered**:
- Learner `POST /jobs/:id/cancel`: out of scope for this feature.
- No cancel at all: leaves workers executing against torn-down sessions.

## Decision 7: Cache-only resilience

**Decision**: Queue connection failures throw `DomainError` with `QUEUE_UNAVAILABLE` only from enqueue paths. Rate-limit / cache Redis usage remains separate; experiment SQL run and auth must not import `JobQueueProducer` as a hard dependency.

**Rationale**: FR-011 / SC-004 and ENGINEERING_GUIDE §15.

**Alternatives considered**:
- Global Redis health gate blocking all APIs: over-couples cache and queue.
