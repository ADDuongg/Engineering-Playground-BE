# Research: Benchmark Runner

**Feature**: 011-benchmark-runner | **Date**: 2026-07-08

## Decision 1: Job queue technology

**Decision**: Use BullMQ on existing Redis infrastructure for benchmark job enqueue and worker consumption.

**Rationale**: SYSTEM_DESIGN §8 and ARCHITECTURE §19 mandate async benchmark execution via queue → worker → k6. Redis is already deployed for cache, dataset status, and rate limits. BullMQ is the documented stack choice (ROADMAP, constitution).

**Alternatives considered**:
- In-process background tasks (used for dataset 1M/10M prep): insufficient for multi-minute k6 runs and worker scaling; no retry semantics.
- Delay until Worker Queue Foundation: blocks P0 Benchmark Runner; foundation explicitly depends on Benchmark Runner first.

## Decision 2: Load test executor

**Decision**: Invoke k6 as a subprocess from the worker with a generated script that load-tests an internal session-scoped benchmark execution URL.

**Rationale**: PRD and SYSTEM_DESIGN reference k6. Subprocess keeps MVP deployable without Docker-in-Docker. Script template lives in repo; worker passes RPS, duration, target URL, and auth/session headers.

**Alternatives considered**:
- k6 Docker sidecar: better isolation for production but adds compose/ops complexity for MVP backend slice.
- Synthetic loop in Node calling Experiment Runner: simpler but does not produce k6 JSON output expected by downstream Benchmark Metrics.

## Decision 3: Job status storage

**Decision**: Persist benchmark job lifecycle snapshots in Redis (keyed by job ID) with TTL; BullMQ carries execution payload only.

**Rationale**: Meets FR-006/FR-007 for queryable status with timestamps. Survives BullMQ job removal after completion. TTL prevents unbounded Redis growth until Platform DB persistence in Benchmark Metrics.

**Alternatives considered**:
- Platform DB table now: premature — Benchmark Metrics owns durable history; adds migration scope.
- BullMQ job progress only: lost after job cleanup; poor fit for learner status polling.

## Decision 4: Benchmark target resolution

**Decision**: Enqueue captures `sessionId`, validated SQL (via sandbox classifier), dataset identity, and RPS/duration. Worker resolves an internal HTTP target that executes the query under the experiment session schema (same isolation rules as Experiment Runner).

**Rationale**: FR-009 requires playground-scoped targets. Reusing experiment session provisioning avoids cross-session load bleed.

**Alternatives considered**:
- Direct PostgreSQL connection from k6: bypasses sandbox limits and session search_path isolation.
- Public `/experiments/sql/run` as k6 target: couples load test to full HTTP auth stack and rate limits on every virtual user request — acceptable for k6 HTTP stage with session token header.

## Decision 5: Concurrency and isolation

**Decision**: Configurable `BENCHMARK_WORKER_CONCURRENCY` (default 2) and per-user max in-flight jobs (default 1 per session).

**Rationale**: FR-010 and SC-004 require bounding resource use. Prevents one learner from filling worker pool.

**Alternatives considered**:
- Unlimited concurrent jobs per user: violates fair-use and risks playground pool exhaustion.
- Global concurrency 1: too restrictive for classroom scenarios with many learners.

## Decision 6: Failure categories

**Decision**: Map failures to spec categories: `VALIDATION_ERROR`, `SESSION_UNAVAILABLE`, `TIMEOUT`, `EXECUTION_ERROR`, `STORAGE_ERROR`, `QUEUE_UNAVAILABLE`.

**Rationale**: Aligns with SC-005 learner-appropriate reasons and existing `DomainError` patterns.

**Alternatives considered**:
- Generic `BENCHMARK_FAILED`: fails learning-first UX requirement.
