# Research: Experiment Runner

**Feature**: 005-experiment-runner | **Date**: 2026-07-08

## 1. Module Boundary vs Extending SQL Sandbox

**Decision**: New `experiment-runner` module that imports `SqlSandboxModule` and `DatasetLoaderModule`.

**Rationale**: SQL Sandbox owns policy validation and playground execution. Experiment Runner owns lab orchestration (readiness gate, context, audit). ARCHITECTURE lists Experiment Execution as a separate module concern. Keeps sandbox reusable for Explain Runner without lab-specific coupling.

**Alternatives considered**:
- **Extend `SqlSandboxController` with dataset params**: Mixes sandbox policy module with lab lifecycle; rejected.
- **Only document sandbox as experiment runner**: Fails FR-002 readiness gate; rejected.

## 2. Dataset Readiness Gate

**Decision**: `RunExperimentSqlUseCase` calls `GetDatasetMetadataUseCase.execute(family, tier, version)` and proceeds only when `metadata.status === DatasetReadinessStatus.READY`. Otherwise throws `DomainError` with code `EXECUTION_ERROR` and details `DATASET_NOT_READY` plus status-specific hint.

**Rationale**: Metadata use case already resolves manifest identity and reads Redis status store — single source of truth per Dataset Loader contract rule #1.

**Alternatives considered**:
- **Direct `DatasetPreparationStatusStore` access**: Duplicates manifest resolution; rejected.
- **Skip gate when tier is 100k and tables exist**: Heuristic fails during `resetting`; rejected.

## 3. HTTP Route and Payload Shape

**Decision**: `POST /experiments/sql/run` with body containing `sql`, `parameters`, `dataset` (`family`, `tier`, `version?`), and `context` (`trackSlug?`, `labSlug?`).

**Rationale**: `/experiments/*` namespace aligns with ROADMAP Experiment Runner and future Explain/Benchmark runners. Dataset identity in body matches prepare/reset DTO patterns.

**Alternatives considered**:
- **`POST /labs/:slug/run`**: Requires lab registry not built; rejected for MVP.
- **Query-param dataset identity only**: Inconsistent with prepare/reset POST bodies; rejected.

## 4. Error Mapping Strategy

**Decision**: Re-throw sandbox `DomainError` unchanged for policy/timeout/validation failures. Wrap dataset-not-ready as new `DomainError` before sandbox invocation. Pass through PostgreSQL execution errors from sandbox layer.

**Rationale**: FR-003 requires identical sandbox outcomes for equivalent inputs. Duplicating error mapping logic rejected.

**Alternatives considered**:
- **New error enum for every experiment failure**: Duplicates sandbox codes; rejected.
- **Generic 500 for not-ready**: Violates learning-first UX; rejected.

## 5. Audit Logging

**Decision**: Structured log event `experiment_sql_run` with phases `started`, `completed`, `failed`. Fields: `requestId`, `trackSlug`, `labSlug`, `userId`, `family`, `tier`, `version`, `durationMs`, `rowCount`, `errorCode`, `statementKind` (on success from validation). Never log `sql` or `parameters`.

**Rationale**: Mirrors `dataset_preparation` / `dataset_reset` patterns. Meets FR-010 and SC-006.

**Alternatives considered**:
- **Persist audit to platform DB**: Out of scope (Audit Log feature); rejected.
- **Log SQL hash only**: Unnecessary for MVP; may add debug flag later.

## 6. Relationship to Existing Sandbox HTTP API

**Decision**: Keep `POST /sql/sandbox/execute` and `POST /sql/sandbox/validate` unchanged. Document in contract that lab shell MUST use `/experiments/sql/run` for learner flows.

**Rationale**: Sandbox HTTP supports integration tests and developer tooling. Experiment runner adds readiness without breaking existing sandbox tests.

**Alternatives considered**:
- **Deprecate sandbox HTTP**: Breaks 002 integration tests and quickstart; rejected for this feature.
- **Redirect sandbox execute to experiment runner**: Changes 002 behavior; rejected.

## 7. Synchronous MVP Execution

**Decision**: MVP runs synchronously in request thread. No job queue, no poll endpoint.

**Rationale**: SQL Execution Queue feature owns async path. Sandbox already enforces timeout. Meets spec assumptions.

**Alternatives considered**:
- **Build minimal queue now**: Scope creep; Worker Queue Foundation not done; rejected.

## 8. Field Metadata in Results

**Decision**: Extend sandbox result mapping to include PostgreSQL field metadata when available from driver (`fields` array on `SandboxExecuteResult` — already in contract). Experiment result passes through unchanged.

**Rationale**: Spec FR-004 requires column metadata. Sandbox contract already defines optional `fields`.

**Alternatives considered**:
- **Infer columns from first row keys only**: Loses type information for empty result sets; rejected.
