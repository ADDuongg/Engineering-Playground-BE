# Implementation Plan: Dataset Loader

**Branch**: `003-dataset-loader` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-dataset-loader/spec.md`

## Summary

Implement a NestJS `dataset-loader` module that loads platform-curated commerce datasets (users, orders, products, logs, payments) into Playground PostgreSQL at configurable tiers (100K / 1M / 10M) and versions. Seed artifacts live in-repo under `seeds/datasets/`; a JSON manifest defines families, tiers, table catalogs, and row-count targets. Preparation runs SQL seed scripts via `PlaygroundDatabaseService`; readiness state is tracked in Redis for polling. HTTP endpoints expose prepare + metadata for lab shells. 100K tier prepares synchronously; 1M/10M use async in-process preparation with Redis status until Worker Queue Foundation (BullMQ) is available.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM/pg (playground connection), ioredis (preparation status), Jest, class-validator

**Storage**: Playground PostgreSQL (seed row data); Redis (preparation status only); static manifest + SQL files in `seeds/datasets/` (no platform DB tables for seed content)

**Testing**: Jest unit tests (manifest parsing, use cases); integration tests against playground DB verifying table counts after 100K load

**Target Platform**: NestJS backend module (`src/modules/dataset-loader/`) with HTTP API

**Project Type**: Web service module with public prepare/metadata endpoints

**Performance Goals**: 100K tier preparation completes in < 30s (spec SC-002); metadata reads < 200ms

**Constraints**: No user uploads; playground-only data; parameterized execution where applicable; large-tier prep must not block HTTP thread (async path)

**Scale/Scope**: One MVP dataset family (`commerce`); three tiers; version pinning via manifest; integrates with existing `PlaygroundDatabaseService` and `RedisService`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Shared dataset types in `src/shared/dataset/`; DTOs validated; exported via `@db-play/types`
- [x] **Feature-first backend**: `DatasetLoaderController` → `PrepareDatasetUseCase` / `GetDatasetMetadataUseCase` → `DatasetManifestRepository` + `DatasetSeedRunner`
- [x] **TypeScript strict**: Typed manifest, inputs, results; no unjustified `any`
- [x] **Testing**: Unit tests for manifest + use cases; integration test for 100K commerce load
- [x] **Learning UX**: `DomainError` with educational messages for invalid family/tier/version and failed preparation
- [x] **Platform vs Playground**: Seed data only in playground; Redis holds ephemeral status; manifest is read-only config
- [x] **Simplicity**: File-based manifest + SQL seeds; no platform DB entity layer for datasets in MVP

**Post-design note**: 1M/10M async preparation uses in-process background execution + Redis status as interim pattern until Worker Queue Foundation delivers BullMQ. Documented in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-dataset-loader/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dataset-service.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Created by /speckit-tasks
```

### Source Code (repository root)

```text
seeds/
└── datasets/
    ├── manifest.json
    └── commerce/
        └── v1/
            ├── schema.sql
            ├── seed-100k.sql
            ├── seed-1m.sql
            └── seed-10m.sql

src/
├── modules/
│   └── dataset-loader/
│       ├── dataset-loader.module.ts
│       ├── dataset-loader.controller.ts
│       ├── dto/
│       │   ├── prepare-dataset.dto.ts
│       │   └── dataset-metadata.response.dto.ts
│       ├── application/
│       │   ├── prepare-dataset.usecase.ts
│       │   ├── prepare-dataset.usecase.spec.ts
│       │   ├── get-dataset-metadata.usecase.ts
│       │   └── get-dataset-metadata.usecase.spec.ts
│       ├── domain/
│       │   └── dataset-manifest.types.ts
│       └── infrastructure/
│           ├── dataset-manifest.repository.ts
│           ├── dataset-seed.runner.ts
│           └── dataset-preparation-status.store.ts
├── shared/
│   └── dataset/
│       ├── dataset-family.enum.ts
│       ├── dataset-tier.enum.ts
│       ├── dataset-readiness-status.enum.ts
│       ├── prepare-dataset-input.ts
│       ├── dataset-metadata.ts
│       └── index.ts
└── app.module.ts                 # import DatasetLoaderModule

test/
└── integration/
    └── dataset-loader.integration-spec.ts
```

**Structure Decision**: Feature module under `src/modules/dataset-loader/` with Controller → UseCase → Infrastructure. Seed SQL and manifest are version-controlled assets, not generated at runtime. `DatasetSeedRunner` executes ordered SQL files against playground. `DatasetPreparationStatusStore` wraps Redis for readiness lifecycle.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| In-process async prep for 1M/10M (not BullMQ yet) | Worker Queue Foundation not implemented; blocking HTTP for 10M rows violates constitution and UX | Sync-only rejected: 10M load exceeds 30s and blocks API; full BullMQ rejected: dependency not ready — interim Redis-tracked async with explicit migration path to workers |
