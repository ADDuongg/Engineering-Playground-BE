# Implementation Plan: Benchmark Metrics

**Branch**: `014-benchmark-metrics` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-benchmark-metrics/spec.md`

## Summary

Extend the Metrics Pipeline to **automatically** collect catalog Metric Contract values (mean latency, P95, P99, achieved RPS, throughput, error rate %) when a Benchmark Runner job completes successfully, persist snapshots on Platform DB for history/comparison, embed `metrics[]` on completed benchmark status, and expose dedicated metrics-by-job + benchmark history endpoints. Derivation reads the load-test summary already attached to the completed job; no re-run and no MVP re-collect.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM, `@nestjs/event-emitter`, existing `MetricsPipelineModule`, `BenchmarkRunnerModule` / `BENCHMARK_FINISHED_EVENT`, Jest

**Storage**: Platform DB `metric_snapshots` (extended for benchmark run type + job/profile metadata); job store payload for status embed only

**Testing**: Unit tests (k6 summary → catalog mapping, listener, retention, ownership); integration tests (auto-collect on completion, status embed, metrics-by-job, history, unauthorized access)

**Target Platform**: NestJS API + benchmark worker process (same monorepo)

**Project Type**: Backend web service (feature module extension)

**Performance Goals**: Metrics-by-job and history ≤ 1s for ≤ 50 snapshots (SC-004/SC-005); collection must not block benchmark job completion marking

**Constraints**: Frontend must not derive rates/percentiles; error rate 0–100%; achieved RPS ≠ throughput; no learner/admin re-collect on collection failure

**Scale/Scope**: Database Track MVP (~6 new catalog keys); session retention default 50 (shared with Metrics Pipeline)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared Metric Contract / run context / status result extensions in `src/shared/`
- [x] **Feature-first backend**: Controller → UseCase → Repository; listener invokes use case (not controller)
- [x] **TypeScript strict**: No unjustified `any`; typed k6 summary parser
- [x] **Testing**: Unit + integration planned; critical path covered
- [x] **Learning UX**: Backend-only metrics; actionable unavailable/error hints
- [x] **Platform vs Playground**: Snapshots on Platform DB; raw summary stays on job for internal derivation only
- [x] **Simplicity**: Extend Metrics Pipeline + thin status embed — no new queue or separate metrics microservice

## Project Structure

### Documentation (this feature)

```text
specs/014-benchmark-metrics/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/benchmark-metrics-service.md
└── tasks.md              # /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
src/modules/metrics-pipeline/
├── application/
│   ├── collect-benchmark-metrics.usecase.ts
│   ├── collect-benchmark-metrics.usecase.spec.ts
│   ├── get-benchmark-metrics.usecase.ts
│   ├── get-benchmark-metrics.usecase.spec.ts
│   └── get-metric-history.usecase.ts          # extend runType filter
├── domain/
│   └── database-metrics.catalog.ts           # add benchmark source + keys
├── infrastructure/
│   ├── k6-summary.parser.ts
│   ├── k6-summary.parser.spec.ts
│   ├── metric-snapshot.entity.ts             # jobId, profile jsonb
│   └── metric-snapshot.repository.ts         # findByJobId, filter runType
├── listeners/
│   └── benchmark-finished.listener.ts
├── dto/
│   ├── get-benchmark-metrics.dto.ts
│   └── get-metric-history.dto.ts             # optional runType
└── metrics-pipeline.controller.ts            # history filter; or benchmark routes

src/modules/benchmark-runner/
├── application/get-benchmark-status.usecase.ts  # embed metrics[] / metricsStatus
└── ...

src/shared/metrics/
├── metric-run-context.ts                     # runType += 'benchmark'
├── metric-snapshot.ts                        # summary fields for profile/jobId
└── ...

src/shared/benchmark/
└── benchmark-job-status-result.ts            # metrics?, metricsStatus?, runId?

src/database/migrations/*-ExtendMetricSnapshotsForBenchmark.ts

test/integration/benchmark-metrics.integration-spec.ts
```

**Structure Decision**: Keep collection/persistence/history in `MetricsPipelineModule` (same bounded context as SQL/EXPLAIN metrics). Benchmark Runner only embeds already-collected metrics on status. Auto-collect via `BENCHMARK_FINISHED_EVENT` listener — no new worker type.

## Complexity Tracking

No constitution violations requiring justification.
