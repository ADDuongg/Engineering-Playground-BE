# Implementation Plan: Experiment Isolation

**Branch**: `006-experiment-isolation` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-experiment-isolation/spec.md`

## Summary

Add an `experiment-isolation` NestJS module that provisions session-scoped Playground PostgreSQL runtime contexts (schema-per-session) for Database Track labs. `ProvisionExperimentSessionUseCase` creates or reuses a session keyed by client session token + lab, assigns a playground schema name, and tracks lifecycle in Redis. Downstream modules (Dataset Loader, Dataset Reset, SQL Sandbox, Experiment Runner) accept optional `sessionId` and scope queries via `SET LOCAL search_path`. Teardown drops session schemas on close or idle expiry. HTTP exposes `POST /experiments/sessions` and `DELETE /experiments/sessions/:sessionId`.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM/pg (playground), Redis, Jest, class-validator — extends `DatasetLoaderModule`, `SqlSandboxModule`, `ExperimentRunnerModule`

**Storage**: Redis for session metadata; Playground PostgreSQL schemas per session; no platform DB entities for runtime content

**Testing**: Jest unit tests (provision, reuse, teardown, recovery); integration tests for cross-session contamination and platform DB unchanged

**Target Platform**: NestJS backend — new `src/modules/experiment-isolation/`

**Project Type**: Cross-cutting runtime module consumed by existing Database Track features

**Performance Goals**: 95% of 100K-tier session provisioning within 10s (spec SC-002); teardown async when exceeding HTTP threshold

**Constraints**: Must not break existing API when `sessionId` omitted (backward-compatible global path during migration); never store playground rows on platform DB; audit logs exclude SQL text

**Scale/Scope**: Database Track MVP; schema isolation only; Authentication integration deferred to optional `userId` on context

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Shared session types in `src/shared/experiment-session/`; DTOs validated; exported via `@db-play/types`
- [x] **Feature-first backend**: `ExperimentIsolationController` → UseCases → Redis store + Playground schema provisioner
- [x] **TypeScript strict**: Typed session lifecycle, schema names, error mapping; no unjustified `any`
- [x] **Testing**: Unit tests for provision/reuse/teardown; integration tests for SC-001, SC-004, SC-006
- [x] **Learning UX**: Categorized isolation errors with retry guidance; Track-aware unsupported messages
- [x] **Platform vs Playground**: Session metadata in Redis only; playground content in session schemas; integration test asserts platform DB unchanged
- [x] **Simplicity**: Schema-per-session on existing Playground PostgreSQL — no new database instances at MVP

**Post-design note**: Dataset status keys gain session prefix when `sessionId` present. Global unprefixed keys remain for backward compatibility until all callers migrate.

## Project Structure

### Documentation (this feature)

```text
specs/006-experiment-isolation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── experiment-isolation-service.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── experiment-isolation/
│       ├── experiment-isolation.module.ts
│       ├── experiment-isolation.controller.ts
│       ├── dto/
│       │   ├── provision-experiment-session.dto.ts
│       │   └── experiment-session-query.dto.ts
│       ├── application/
│       │   ├── provision-experiment-session.usecase.ts
│       │   ├── get-experiment-session.usecase.ts
│       │   ├── teardown-experiment-session.usecase.ts
│       │   └── *.spec.ts
│       └── infrastructure/
│           ├── experiment-session.store.ts
│           ├── playground-schema.provisioner.ts
│           └── playground-schema.provisioner.spec.ts
├── shared/
│   └── experiment-session/
│       ├── experiment-session-status.enum.ts
│       ├── experiment-session.ts
│       ├── provision-experiment-session-input.ts
│       └── index.ts
├── database/
│   └── playground/
│       └── playground-database.service.ts   # add withSchemaScope helper

test/
└── integration/
    └── experiment-isolation.integration-spec.ts
```

**Structure Decision**: New `experiment-isolation` module owns session lifecycle. Existing modules gain optional `sessionId` on inputs and delegate schema scoping to `PlaygroundDatabaseService.withSchemaScope()` rather than duplicating connection logic.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Session-prefixed dataset status keys | FR-003 requires per-session readiness independent of global state | Single global Redis key fails cross-session isolation (SC-001) |
| Optional `sessionId` on existing DTOs | Backward compatibility during lab shell migration | Breaking all prepare/run APIs rejected — breaks existing integration tests |
| Schema-per-session vs shared public schema | FR-004 concurrent isolation on single Playground PG instance | Separate database per session rejected — ops overhead exceeds MVP need |
