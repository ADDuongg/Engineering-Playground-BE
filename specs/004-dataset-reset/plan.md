# Implementation Plan: Dataset Reset

**Branch**: `004-dataset-reset` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-dataset-reset/spec.md`

## Summary

Extend the existing `dataset-loader` module with a `ResetDatasetUseCase` that restores Playground PostgreSQL to the lab's configured dataset baseline on demand. Reset tears down learner-created artifacts (extra tables, indexes, and data mutations) via a scoped playground teardown step, then reuses `DatasetSeedRunner` and manifest resolution from Dataset Loader. Readiness lifecycle adds a `resetting` status to the shared `DatasetReadinessStatus` enum and reuses the Redis-backed `DatasetPreparationStatusStore`. HTTP exposes `POST /datasets/reset` and `GET /datasets/reset/status` mirroring prepare async semantics (sync 100K, async 1M/10M). Structured audit logs use event `dataset_reset` with the same correlation fields as preparation.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM/pg (playground connection), ioredis (status), Jest, class-validator — reuses Dataset Loader infrastructure

**Storage**: Playground PostgreSQL (teardown + re-seed); Redis (reset/preparation status); no platform DB changes

**Testing**: Jest unit tests (reset use case, teardown runner); integration tests mutating playground then verifying baseline restoration

**Target Platform**: NestJS backend — extends `src/modules/dataset-loader/`

**Project Type**: Web service module with new reset endpoints on existing `/datasets` controller

**Performance Goals**: 100K-tier reset completes in < 30s (spec SC-003); metadata reflects restored counts after reset

**Constraints**: Platform DB untouched; no user uploads; deduplicate in-flight reset/prepare for same identity; large-tier reset must not block HTTP thread

**Scale/Scope**: Commerce dataset family; reuses manifest, seed SQL, and tier sync/async thresholds from Dataset Loader

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Shared reset types in `src/shared/dataset/`; DTOs validated; exported via `@db-play/types`
- [x] **Feature-first backend**: `DatasetLoaderController` → `ResetDatasetUseCase` → `DatasetPlaygroundTeardown` + `DatasetSeedRunner` + `DatasetPreparationStatusStore`
- [x] **TypeScript strict**: Typed inputs, results, teardown; no unjustified `any`
- [x] **Testing**: Unit tests for reset use case and teardown; integration test for mutation → reset → baseline verification
- [x] **Learning UX**: `DomainError` with educational messages for invalid identity, in-flight conflicts, and failed reset
- [x] **Platform vs Playground**: Reset affects playground only; Redis holds ephemeral status; audit logs exclude query text
- [x] **Simplicity**: Reuses seed runner and status store; single teardown helper rather than new module boundary

**Post-design note**: Large-tier reset uses the same in-process async + Redis pattern as Dataset Loader until Worker Queue Foundation delivers BullMQ. Documented in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/004-dataset-reset/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dataset-reset-service.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── dataset-loader/                    # Extended — reset lives here
│       ├── dataset-loader.controller.ts   # + POST /reset, GET /reset/status
│       ├── dto/
│       │   └── reset-dataset.dto.ts
│       ├── application/
│       │   ├── reset-dataset.usecase.ts
│       │   └── reset-dataset.usecase.spec.ts
│       └── infrastructure/
│           └── dataset-playground-teardown.ts
│           └── dataset-playground-teardown.spec.ts
├── shared/
│   └── dataset/
│       ├── dataset-readiness-status.enum.ts  # + RESETTING
│       ├── reset-dataset-input.ts
│       ├── reset-dataset-result.ts
│       └── index.ts

test/
└── integration/
    └── dataset-reset.integration-spec.ts
```

**Structure Decision**: Reset extends `dataset-loader` rather than a new NestJS module because it shares manifest resolution, seed execution, status store, and HTTP base path. Feature traceability remains in `specs/004-dataset-reset/`. `DatasetPlaygroundTeardown` drops learner-created objects not in the manifest before `DatasetSeedRunner.run()` reloads baseline.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| In-process async reset for 1M/10M (not BullMQ yet) | Worker Queue Foundation not implemented; blocking HTTP for 10M violates constitution and UX | Calling prepare-only without teardown rejected: learner-created extra tables survive schema.sql scoped drops; sync-only rejected for large tiers |
| `RESETTING` status distinct from `PREPARING` | Spec FR-005 and audit require reset-specific lifecycle; labs must distinguish restore vs initial load | Reusing `preparing` only rejected: ambiguous UX and audit conflation |
