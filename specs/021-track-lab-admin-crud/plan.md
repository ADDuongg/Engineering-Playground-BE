# Implementation Plan: Track & Lab Admin CRUD

**Branch**: `021-track-lab-admin-crud` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-track-lab-admin-crud/spec.md`

## Summary

Add admin create/update/list/get for Track and Lab catalog metadata on Platform DB so operators can register labs without migration-only seeds. Reuse Admin AuthZ (`@Roles(Role.ADMIN)` under `/api/v1/admin/*`). Introduce Lab `status` (`active` | `coming-soon`) with backfill of existing rows to `active`; create defaults to `coming-soon` when status omitted. Validate Track config identifiers against known platform sets. Learner path/progress include `coming-soon` Labs with status visible; start/summary blocked until `active`. No hard delete, no playground writes, no guided-step/quiz admin.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM (Platform DB), class-validator, existing Admin AuthZ / Tracks / Progress modules, Jest + Supertest

**Storage**: Platform DB only — extend `labs` with `status`; reuse `tracks` table; no playground schema changes

**Testing**: Unit tests for admin create/update use cases + validators; integration tests for admin CRUD AuthZ and learner visibility/gating after status changes

**Target Platform**: NestJS API service (backend-only)

**Project Type**: Web-service API (NestJS monorepo backend)

**Performance Goals**: Admin catalog list/get p95 ≤ 200ms under normal load; create/update ≤ 500ms; no playground round-trips

**Constraints**: Platform vs playground separation; slug immutable after create; no Lab track-move; no hard delete; duplicate `sequence_order` allowed (sort by order, slug); known-set config validation; FE admin UI out of scope

**Scale/Scope**: Admin tracks + labs write/list surfaces; Lab status column + learner path/progress/summary gating; shared enums for LabStatus + VisualizationKitId; MetricCatalogId completed for seeded catalog ids

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared Track/Lab admin DTOs and `LabStatus` / `VisualizationKitId` in `src/shared/`; reuse existing Track enums
- [x] **Feature-first backend**: Admin controllers → UseCases → TrackRepository / LabRepository; no forbidden deps
- [x] **TypeScript strict**: No unjustified `any`
- [x] **Testing**: Unit + integration tests planned; AuthZ + catalog + learner gating covered
- [x] **Learning UX**: Actionable validation/conflict/not-found/coming-soon errors
- [x] **Platform vs Playground**: Catalog writes Platform DB only; playground untouched; reset must not affect catalog
- [x] **Simplicity**: Extend existing admin/tracks/progress modules and repositories; no parallel catalog store; no hard-delete subsystem

**Post-design re-check**: Pass — design extends existing entities/repos and admin namespace; adds one migration + known-id enums; learner response gains `status` field only.

## Project Structure

### Documentation (this feature)

```text
specs/021-track-lab-admin-crud/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/track-lab-admin-api.md
└── tasks.md                 # /speckit-tasks (not created by plan)
```

### Source Code (repository root)

```text
src/shared/
├── tracks/
│   ├── lab-status.enum.ts                 # NEW: active | coming-soon
│   ├── visualization-kit-id.enum.ts       # NEW: known viz kit ids
│   ├── track-admin.ts                     # NEW: admin track request/response types
│   └── ...existing track enums/DTOs
├── metrics/
│   └── metric-catalog-id.enum.ts          # EXTEND: include seeded redis/react ids
├── progress/
│   └── progress-responses.ts              # EXTEND: LabPathItem.status
└── index.ts                               # export new types

src/modules/admin/
├── admin.module.ts                        # import TracksModule + ProgressModule; register controllers/usecases
├── admin.controller.ts                    # keep GET /admin/me
├── admin-tracks.controller.ts             # NEW: /admin/tracks
├── admin-labs.controller.ts               # NEW: /admin/tracks/:trackSlug/labs (+ get by lab slug)
├── application/
│   ├── create-track.usecase.ts
│   ├── update-track.usecase.ts
│   ├── list-admin-tracks.usecase.ts
│   ├── get-admin-track.usecase.ts
│   ├── create-lab.usecase.ts
│   ├── update-lab.usecase.ts
│   ├── list-admin-labs.usecase.ts
│   ├── get-admin-lab.usecase.ts
│   └── *.spec.ts
├── dto/                                   # create/update/param DTOs
└── mappers/                               # entity → admin response

src/modules/tracks/
├── infrastructure/track.repository.ts     # add create/update/findById; keep findAllOrdered/findBySlug
└── ...existing learner read use cases unchanged (read same table)

src/modules/progress/
├── entities/lab.entity.ts                 # add status column
├── infrastructure/lab.repository.ts       # add create/update; keep ordered finds
└── mappers/progress.mapper.ts             # include status on LabPathItem

src/modules/labs/
└── application/get-lab-summary.usecase.ts # gate on lab.status === active (in addition to track)

src/database/migrations/
└── 1730700000000-AddLabStatusAndBackfill.ts

src/database/platform/
├── data-source.ts                         # register migration
└── platform-database.module.ts            # register migration if runtime list is used

test/integration/
└── track-lab-admin.integration-spec.ts
```

**Structure Decision**: Keep operator HTTP under `src/modules/admin/` (namespace continuity with Admin AuthZ). Persist via existing `TrackRepository` / `LabRepository` owned by tracks/progress modules (single Platform catalog). Do not invent a second catalog module or shadow tables.

## Complexity Tracking

No constitution violations requiring justification.
