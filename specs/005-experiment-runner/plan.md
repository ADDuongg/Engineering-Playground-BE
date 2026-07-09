# Implementation Plan: Experiment Runner

**Branch**: `005-experiment-runner` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-experiment-runner/spec.md`

## Summary

Add a dedicated `experiment-runner` NestJS module that exposes the lab-facing SQL execution path. `RunExperimentSqlUseCase` gates on dataset readiness via `GetDatasetMetadataUseCase`, delegates validation and execution to `ExecuteSandboxedSqlUseCase`, maps sandbox and database errors into experiment-scoped responses, and emits structured `experiment_sql_run` audit logs. HTTP exposes `POST /experiments/sql/run` with dataset identity and lab context. Shared contracts live in `src/shared/experiment/`. The existing `/sql/sandbox/*` endpoints remain for direct sandbox access; labs use the experiment runner path that enforces readiness.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM/pg (playground via sandbox), Jest, class-validator — consumes `SqlSandboxModule` and `DatasetLoaderModule`

**Storage**: Playground PostgreSQL only for SQL execution; Redis (indirect via dataset metadata status); no platform DB access

**Testing**: Jest unit tests (run use case, readiness gate); integration tests for ready/not-ready/success/error paths

**Target Platform**: NestJS backend — new `src/modules/experiment-runner/`

**Project Type**: Web service module with lab-facing experiment execution endpoint

**Performance Goals**: Valid SELECT on 100K-tier ready dataset returns within 30s (spec SC-001); readiness check adds negligible overhead vs direct sandbox call

**Constraints**: Must not duplicate sandbox rules; block when status ≠ `ready`; never inject platform DB; audit logs exclude full SQL/parameters

**Scale/Scope**: Database Track MVP; synchronous execution only; commerce dataset family for integration tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Shared `ExperimentRunInput` / `ExperimentRunResult` in `src/shared/experiment/`; DTOs validated; exported via `@db-play/types`
- [x] **Feature-first backend**: `ExperimentRunnerController` → `RunExperimentSqlUseCase` → `GetDatasetMetadataUseCase` + `ExecuteSandboxedSqlUseCase`
- [x] **TypeScript strict**: Typed inputs, results, error mapping; no unjustified `any`
- [x] **Testing**: Unit tests for readiness gate and error mapping; integration test matrix for SC-002–SC-005
- [x] **Learning UX**: Reuses sandbox `DomainError` hints; adds dataset-not-ready messages with lab context
- [x] **Platform vs Playground**: Execution path uses sandbox/playground only; integration test asserts platform DB unchanged
- [x] **Simplicity**: Thin orchestration layer — no new SQL validation or connection management

**Post-design note**: Readiness check calls existing metadata use case rather than new repository. Queue-based async execution deferred to SQL Execution Queue feature.

## Project Structure

### Documentation (this feature)

```text
specs/005-experiment-runner/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── experiment-runner-service.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── experiment-runner/
│       ├── experiment-runner.module.ts
│       ├── experiment-runner.controller.ts
│       ├── dto/
│       │   └── run-experiment-sql.dto.ts
│       └── application/
│           ├── run-experiment-sql.usecase.ts
│           └── run-experiment-sql.usecase.spec.ts
├── shared/
│   └── experiment/
│       ├── experiment-run-input.ts
│       ├── experiment-run-result.ts
│       └── index.ts

test/
└── integration/
    └── experiment-runner.integration-spec.ts
```

**Structure Decision**: New `experiment-runner` module (not extension of `sql-sandbox`) because orchestration concerns — dataset readiness, lab context, audit — are distinct from sandbox policy enforcement. Module imports `SqlSandboxModule` and `DatasetLoaderModule` exports. Register in `app.module.ts`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Two HTTP paths for SQL (`/sql/sandbox` and `/experiments/sql/run`) | Sandbox endpoint predates runner; labs need readiness-gated path per spec FR-002 | Removing sandbox HTTP breaks existing tests and dev workflows; merging into one controller blurs module boundaries |
| Metadata fetch on every run | FR-002 requires authoritative readiness gate | Trusting client-side ready flag rejected: stale UI could execute against empty or resetting playground |
