# Implementation Plan: Explain Runner

**Branch**: `007-explain-runner` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

## Summary

Add `explain-runner` NestJS module exposing `POST /experiments/sql/explain`. `RunExplainUseCase` gates on dataset readiness and optional session scope (mirroring Experiment Runner), wraps learner SQL as `EXPLAIN (FORMAT JSON)` / `EXPLAIN (ANALYZE, FORMAT JSON)`, delegates validation and execution to SQL Sandbox, parses PostgreSQL JSON plans into structured `ExplainPlanNode` trees via `ExplainPlanParser`, and emits `explain_sql_run` audit logs. Shared contracts in `src/shared/explain/`.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, pg (via sandbox), Jest — consumes `SqlSandboxModule`, `DatasetLoaderModule`, `ExperimentIsolationModule`

**Storage**: Playground PostgreSQL only; no platform DB access

**Testing**: Unit tests (use case, plan parser); integration tests for explain/explain_analyze, not-ready, sandbox violation, structured tree

**Constraints**: Sandbox sole authority for policy; structured plan tree required; raw text supplementary only

## Constitution Check

- [x] Shared contracts in `src/shared/explain/`
- [x] Controller → UseCase → Sandbox + Parser
- [x] Unit + integration tests
- [x] Backend-normalized plan payload for visualization
- [x] Platform/playground separation preserved

## Project Structure

```text
src/modules/explain-runner/
├── explain-runner.module.ts
├── explain-runner.controller.ts
├── dto/run-explain.dto.ts
├── application/run-explain.usecase.ts
├── application/run-explain.usecase.spec.ts
└── infrastructure/explain-plan.parser.ts
    infrastructure/explain-plan.parser.spec.ts

src/shared/explain/
├── explain-mode.enum.ts
├── explain-plan-node.ts
├── explain-run-input.ts
├── explain-run-result.ts
└── index.ts

test/integration/explain-runner.integration-spec.ts
```

**Structure Decision**: Separate module from experiment-runner — explain orchestration, plan parsing, and explain-specific contracts are distinct from row-returning SQL execution.
