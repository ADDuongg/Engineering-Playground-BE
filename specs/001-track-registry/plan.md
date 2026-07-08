# Implementation Plan: Track Registry

**Branch**: `001-track-registry` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-track-registry/spec.md`

## Summary

Implement a read-only Track Registry on Platform DB so the platform can discover learning domains and resolve per-Track configuration (Runtime Adapter, Input Surface, Metric Catalog, Visualization Kit). Follows existing NestJS auth module patterns: `TrackModule` with Controller → UseCase → Repository, TypeORM entity on `platform` connection, seed migration for three MVP Tracks, public `GET /tracks` and `GET /tracks/:slug` endpoints with shared DTOs in `@db-play/types`.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM, class-validator, Swagger, Jest, Supertest

**Storage**: Platform PostgreSQL (`platform` TypeORM connection) — `tracks` table

**Testing**: Jest unit tests (UseCases), Supertest integration tests (API endpoints)

**Target Platform**: NestJS API server (monorepo `src/`)

**Project Type**: Web service (backend feature; frontend consumers later)

**Performance Goals**: Track list p95 < 1s (spec SC-001); small catalog (~3–10 rows) — simple indexed query sufficient

**Constraints**: Read-only API for MVP; no admin CRUD; Platform vs Playground separation; standard API envelope; `@Public()` on list/detail endpoints

**Scale/Scope**: 3 seeded Tracks for MVP; extensible schema for future Tracks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Shared Track DTOs and enums in `src/shared/tracks/`; API responses use envelope
- [x] **Feature-first backend**: `TracksController` → `ListTracksUseCase` / `GetTrackBySlugUseCase` → `TrackRepository`
- [x] **TypeScript strict**: Entity, DTOs, mappers typed; enums exported from shared
- [x] **Testing**: Unit tests for use cases; integration tests for both endpoints
- [x] **Learning UX**: `NOT_FOUND` returns learner-friendly message; `coming-soon` status explicit in response
- [x] **Platform vs Playground**: `tracks` table on Platform DB only; unaffected by playground reset
- [x] **Simplicity**: Single module, seed migration, no cache layer needed for MVP catalog size

## Project Structure

### Documentation (this feature)

```text
specs/001-track-registry/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── tracks-api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── tracks/
│       ├── tracks.module.ts
│       ├── tracks.controller.ts
│       ├── application/
│       │   ├── list-tracks.usecase.ts
│       │   ├── list-tracks.usecase.spec.ts
│       │   ├── get-track-by-slug.usecase.ts
│       │   └── get-track-by-slug.usecase.spec.ts
│       ├── dto/
│       │   └── track-slug.param.dto.ts
│       ├── entities/
│       │   └── track.entity.ts
│       ├── infrastructure/
│       │   └── track.repository.ts
│       └── mappers/
│           └── track.mapper.ts
├── shared/
│   ├── tracks/
│   │   ├── track-summary.ts
│   │   ├── track-detail.ts
│   │   ├── track-status.enum.ts
│   │   ├── runtime-adapter-type.enum.ts
│   │   └── input-surface-type.enum.ts
│   └── index.ts
├── database/
│   └── migrations/
│       └── 1730100000000-InitTracksTable.ts
└── app.module.ts

test/
└── integration/
    └── tracks.e2e-spec.ts
```

**Structure Decision**: Single NestJS backend module under `src/modules/tracks/`, mirroring `auth` module layout. Shared contracts in `src/shared/tracks/` exported via `@db-play/types`.

## Complexity Tracking

> No constitution violations requiring justification.
