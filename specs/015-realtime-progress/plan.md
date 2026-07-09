# Implementation Plan: Realtime Progress

**Branch**: `015-realtime-progress` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-realtime-progress/spec.md`

## Summary

Add push-only live progress for in-flight Benchmark Runner jobs: SSE stream of ephemeral progress snapshots (phase, elapsed time, current RPS, provisional latency/error preview). Worker publishes interim observations via Redis (latest snapshot + pub/sub); API fans out to authenticated owners. Terminal signal closes the stream without final metrics — labs use existing status / Benchmark Metrics APIs for finals.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, ioredis (Redis snapshot + pub/sub), existing BullMQ benchmark worker, Jest; optional RxJS for SSE Observable

**Storage**: Redis ephemeral keys only (`benchmark:progress:{jobId}` latest snapshot + pub/sub channel); **no** Platform DB tables for in-run progress

**Testing**: Unit tests (progress store, partial metrics mapper, ownership, reconnect seed); integration tests (SSE stream during run, reconnect, terminal handoff, forbidden)

**Target Platform**: NestJS API + dedicated `benchmark-worker` process (cross-process via Redis)

**Project Type**: Backend web service (feature extension of Benchmark Runner)

**Performance Goals**: Reconnect resume ≤ 3s (SC-002); progress publish cadence ~1 Hz bounded; SSE must not wrap in response envelope

**Constraints**: Push-only (no progress-via-polling); ephemeral latest-only; no inventing zeros; terminal stream has no final Metric Contract; frontend must not derive engineering metrics

**Scale/Scope**: Database Track benchmark jobs only; concurrent learners observing own jobs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared progress snapshot / partial metrics types in `src/shared/benchmark/`
- [x] **Feature-first backend**: Controller → UseCase → Store; worker publishes via infrastructure, not controller
- [x] **TypeScript strict**: Typed SSE payloads and Redis JSON; no unjustified `any`
- [x] **Testing**: Unit + integration planned; critical reconnect/terminal paths covered
- [x] **Learning UX**: Backend-only progress fields; provisional clearly distinct from finals
- [x] **Platform vs Playground**: Ephemeral Redis only; no Platform DB progress history; load still playground-scoped
- [x] **Simplicity**: SSE + Redis pub/sub (first streaming transport); no WebSocket/socket.io for MVP

**Post-design note**: First SSE endpoint in the codebase. Cross-process bridge required because worker EventEmitter2 does not reach the API process. k6 executor must emit interim observations (today it is end-of-run only).

## Project Structure

### Documentation (this feature)

```text
specs/015-realtime-progress/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/realtime-progress-service.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
src/shared/benchmark/
├── benchmark-progress-snapshot.ts      # snapshot + terminal signal types
├── benchmark-progress.events.ts        # Redis channel naming / event constants
└── index.ts                            # exports

src/modules/benchmark-runner/
├── application/
│   ├── observe-benchmark-progress.usecase.ts
│   └── observe-benchmark-progress.usecase.spec.ts
├── infrastructure/
│   ├── benchmark-progress.store.ts     # Redis latest snapshot + publish
│   ├── benchmark-progress.store.spec.ts
│   ├── k6-progress.mapper.ts           # interim k6 → partial metrics
│   └── k6-benchmark.executor.ts        # extend: onProgress callback / stream
├── dto/
│   └── observe-benchmark-progress.dto.ts
└── benchmark-runner.controller.ts      # GET .../progress (SSE)

src/workers/
└── benchmark-worker.processor.ts       # write/publish on running + ticks + terminal

test/integration/
└── realtime-progress.integration-spec.ts
```

**Structure Decision**: Keep progress inside `BenchmarkRunnerModule` (same ownership/lifecycle as jobs). Redis store mirrors `DatasetPreparationStatusStore` pattern. No new Nest module; no Platform DB migration.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| First SSE transport | Spec requires push-only live stream; ARCHITECTURE lists SSE as future | Status polling rejected by clarification; WebSocket/socket.io heavier for one-way progress |
| Redis pub/sub + snapshot (not EventEmitter2 alone) | Worker is a separate process; in-process events never reach API SSE | Polling Redis from SSE without pub/sub works but adds latency; pure EventEmitter2 cannot cross processes |
| k6 interim streaming | Current executor is blocking end-of-run only | Fake progress from wall-clock alone cannot supply real RPS/latency/error preview |
