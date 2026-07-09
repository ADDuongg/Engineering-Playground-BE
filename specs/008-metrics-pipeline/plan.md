# Implementation Plan: Metrics Pipeline

**Branch**: `008-metrics-pipeline` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

## Summary

Add `metrics-pipeline` NestJS module that transforms Experiment Runner and Explain Runner outcomes into Track-scoped **Metric Contract** arrays, persists **Metric Snapshots** on Platform DB for before/after comparison, and exposes history retrieval. Shared contracts live in `src/shared/metrics/`. Experiment and explain success responses embed `metrics[]` inline; a dedicated history endpoint supports lab comparison flows. MVP covers the Database Track catalog (`database-metrics`) only.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM, PostgreSQL (Platform DB), Jest — consumes outputs from `ExperimentRunnerModule`, `ExplainRunnerModule`, and Track `metricCatalogId`

**Storage**: Platform DB for `metric_snapshots` (permanent history); playground remains execution-only

**Testing**: Unit tests (catalog collectors, aggregation, retention); integration tests (inline metrics on run/explain, history CRUD, retention prune)

**Performance Goals**: Snapshot persistence ≤ 200ms p95 additive; history retrieval ≤ 1s for 50 snapshots

**Constraints**: Frontend must not derive engineering metrics; numeric Metric Contract only; failed runs emit no success metrics

**Scale/Scope**: Database Track MVP catalog (~8 metrics); 50 snapshots/session retention default

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared types in `src/shared/metrics/`; extend run results with `metrics[]`
- [x] **Feature-first backend**: Controller → UseCase → Repository for history; collectors as injectable services
- [x] **TypeScript strict**: No unjustified `any`
- [x] **Testing**: Unit + integration tests planned
- [x] **Learning UX**: Backend-sourced metrics; partial derivation with diagnostic hints
- [x] **Platform vs Playground**: Snapshots on Platform DB; derivation reads in-memory run results only
- [x] **Simplicity**: Single module; catalog as typed config file; no worker queue for MVP persistence

## Project Structure

### Documentation (this feature)

```text
specs/008-metrics-pipeline/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/metrics-pipeline-service.md
└── tasks.md
```

### Source Code (repository root)

```text
src/modules/metrics-pipeline/
├── metrics-pipeline.module.ts
├── metrics-pipeline.controller.ts
├── dto/get-metric-history.dto.ts
├── application/
│   ├── collect-execution-metrics.usecase.ts
│   ├── collect-explain-metrics.usecase.ts
│   ├── persist-metric-snapshot.usecase.ts
│   ├── get-metric-history.usecase.ts
│   └── *.spec.ts
├── domain/
│   ├── metric-catalog.types.ts
│   └── database-metrics.catalog.ts
└── infrastructure/
    ├── metric-snapshot.entity.ts
    └── metric-snapshot.repository.ts

src/shared/metrics/
├── metric-contract.ts
├── metric-snapshot.ts
├── metric-run-context.ts
├── metric-catalog-id.enum.ts
└── index.ts

src/database/migrations/*-CreateMetricSnapshotsTable.ts

test/integration/metrics-pipeline.integration-spec.ts
```

**Structure Decision**: Dedicated module rather than embedding collectors inside experiment-runner — metrics aggregation, catalog resolution, persistence, and history API are a distinct bounded context consumed by runners via exported use cases.

## Complexity Tracking

No constitution violations requiring justification.
