# Implementation Plan: SQL Sandbox & Resource Limits

**Branch**: `002-sql-sandbox` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-sql-sandbox/spec.md`

## Summary

Implement a reusable Playground PostgreSQL SQL sandbox module that validates statements before execution, enforces parameterized-query-only rules, blocks dangerous statement classes, applies per-query timeout and row caps, and returns categorized educational errors. No HTTP endpoints in this feature — the sandbox is a NestJS module consumed by future Experiment Runner and Explain Runner. Uses existing `PlaygroundDatabaseService`, shared contracts in `@db-play/types`, and `DomainError` with `SANDBOX_ERROR` / `TIMEOUT` codes.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM/pg (playground connection), `pgsql-ast-parser` (statement classification), Jest

**Storage**: Playground PostgreSQL only (disposable runtime DB); no Platform DB tables

**Testing**: Jest unit tests (validator, classifier, use case); integration tests against playground DB with fixture SQL

**Target Platform**: NestJS backend module (`src/modules/sql-sandbox/`)

**Project Type**: Internal service module (no public HTTP API in this feature)

**Performance Goals**: Validation < 10ms for typical lab queries; timeout enforcement within 5s of configured limit (spec SC-004)

**Constraints**: Parameterized queries only; playground connection only; no rate limiting; safe defaults if env config missing (30s timeout, 10k max rows)

**Scale/Scope**: Single-statement execution; MVP allowlist covers SELECT, EXPLAIN, CREATE/DROP INDEX on playground schema

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Shared sandbox types in `src/shared/sandbox/`; exported via `@db-play/types`
- [x] **Feature-first backend**: `ExecuteSandboxedSqlUseCase` + `ValidateSqlStatementService`; playground access via existing `PlaygroundDatabaseService` (no Controller in this feature)
- [x] **TypeScript strict**: Typed inputs/outputs; AST parser types handled explicitly
- [x] **Testing**: Unit tests for validation/classification; integration tests with playground DB
- [x] **Learning UX**: `DomainError` messages educational; error codes `SANDBOX_ERROR`, `TIMEOUT`, `EXECUTION_ERROR`
- [x] **Platform vs Playground**: All execution on playground connection; no platform DB access
- [x] **Simplicity**: Single module, one primary use case, config via existing `ConfigModule`; no new queue/worker

## Project Structure

### Documentation (this feature)

```text
specs/002-sql-sandbox/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sandbox-service.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── sql-sandbox/
│       ├── sql-sandbox.module.ts
│       ├── application/
│       │   ├── execute-sandboxed-sql.usecase.ts
│       │   ├── execute-sandboxed-sql.usecase.spec.ts
│       │   ├── validate-sql-statement.service.ts
│       │   └── validate-sql-statement.service.spec.ts
│       ├── domain/
│       │   ├── statement-classifier.ts
│       │   ├── statement-classifier.spec.ts
│       │   └── blocked-statement.rules.ts
│       └── config/
│           └── sandbox.config.ts
├── shared/
│   └── sandbox/
│       ├── sandbox-execute-input.ts
│       ├── sandbox-execute-result.ts
│       ├── sandbox-violation-code.enum.ts
│       └── index.ts
├── config/
│   ├── configuration.ts          # add sandbox.* keys
│   └── env.validation.ts         # add sandbox env vars
└── app.module.ts                 # import SqlSandboxModule

test/
└── integration/
    └── sql-sandbox.integration-spec.ts
```

**Structure Decision**: Internal NestJS feature module under `src/modules/sql-sandbox/` with no controller. Validation logic split into `ValidateSqlStatementService` (pre-flight) and `ExecuteSandboxedSqlUseCase` (validate → execute with limits). Shared DTOs in `src/shared/sandbox/`.

## Complexity Tracking

> No constitution violations requiring justification.
