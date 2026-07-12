# Implementation Plan: Lab Flow Admin

**Branch**: `022-lab-flow-admin` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-lab-flow-admin/spec.md`

## Summary

Persist lab guided steps and named summary curriculum on Platform DB so lab summary is content-driven. Admin CRUD + reorder for steps and create/partial-update for curriculum under `/api/v1/admin/*`. Seed Index Playground once from current in-repo content (skip if curriculum or any steps already exist). Hard cutover: learner `GET /labs/:labSlug/summary` reads Platform DB only — remove in-repo registry fallback. Preserve existing `LabSummaryResponse` field shape.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM (Platform DB), class-validator, existing Admin AuthZ / Labs / Progress modules, Jest + Supertest

**Storage**: Platform DB only — new `lab_summary_curricula` (1:1 Lab) + `lab_guided_steps` (1:N Lab); no playground schema changes

**Testing**: Unit tests for curriculum/step use cases + action validation; integration tests for admin AuthZ, reorder, seed skip, learner summary from DB after cutover

**Target Platform**: NestJS API service (backend-only)

**Project Type**: Web-service API (NestJS monorepo backend)

**Performance Goals**: Admin step list/get and learner summary p95 ≤ 200ms under normal load; reorder/create ≤ 500ms; no playground round-trips

**Constraints**: Platform vs playground separation; hard cutover (no TypeScript fallback); seed skip-if-exists; curriculum create-once + PATCH (omit unchanged, explicit null clears nullable); hard delete steps allowed; FE admin UI out of scope; Quiz Admin CRUD out of scope

**Scale/Scope**: Index Playground migration + admin APIs for any Lab; shared `LabGuidedStepAction` already exists; extend shared admin types; retire `lab-summary.content` / registry as runtime source

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared lab-flow admin types + reuse `LabSummaryResponse` / `LabGuidedStep` in `src/shared/`
- [x] **Feature-first backend**: Admin controllers → UseCases → repositories; learner summary UseCase reads repos
- [x] **TypeScript strict**: No unjustified `any`
- [x] **Testing**: Unit + integration planned; AuthZ, seed skip, hard cutover covered
- [x] **Learning UX**: Actionable validation/conflict/not-found errors; summary shape unchanged for FE
- [x] **Platform vs Playground**: Flow content on Platform DB only; playground untouched
- [x] **Simplicity**: Extend admin + labs modules; two tables; no versioning/CMS subsystem

**Post-design re-check**: Pass — design reuses admin namespace and existing summary contract; adds two Platform tables + seed migration; removes registry as runtime dependency without new architectural layers.

## Project Structure

### Documentation (this feature)

```text
specs/022-lab-flow-admin/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/lab-flow-admin-api.md
└── tasks.md                 # /speckit-tasks (not created by plan)
```

### Source Code (repository root)

```text
src/shared/
├── labs/
│   ├── lab-summary.ts              # existing learner response + LabGuidedStepAction
│   └── lab-flow-admin.ts           # NEW: admin step/curriculum request/response types
└── index.ts                        # export new types

src/modules/admin/
├── admin.module.ts                 # register lab-flow controllers/usecases; import LabsModule exports
├── admin-lab-flow.controller.ts    # NEW: steps + curriculum under /admin/labs/:labSlug/...
├── application/
│   ├── create-lab-guided-step.usecase.ts
│   ├── update-lab-guided-step.usecase.ts
│   ├── delete-lab-guided-step.usecase.ts
│   ├── list-lab-guided-steps.usecase.ts
│   ├── reorder-lab-guided-steps.usecase.ts
│   ├── create-lab-curriculum.usecase.ts
│   ├── update-lab-curriculum.usecase.ts
│   ├── get-lab-curriculum.usecase.ts
│   ├── lab-guided-step-action.validator.ts
│   └── *.spec.ts
├── dto/                            # create/update/reorder/param DTOs (null-aware PATCH)
└── mappers/                        # entity → admin views

src/modules/labs/
├── entities/
│   ├── lab-summary-curriculum.entity.ts   # NEW
│   └── lab-guided-step.entity.ts          # NEW
├── infrastructure/
│   ├── lab-summary-curriculum.repository.ts  # NEW
│   ├── lab-guided-step.repository.ts         # NEW
│   ├── lab-summary.registry.ts               # REMOVE runtime use (delete or keep unused for seed source only during migration authoring)
│   └── lab-summary.content.ts                # seed source constants only until migration authored; then unused at runtime
├── application/get-lab-summary.usecase.ts    # load curriculum + steps from repos
├── mappers/lab-summary.mapper.ts             # map DB entities → LabSummaryResponse
└── labs.module.ts                            # register entities/repos; export repos for admin

src/database/migrations/
└── 1730800000000-CreateLabFlowTablesAndSeedIndexPlayground.ts

src/database/platform/
├── data-source.ts
└── platform-database.module.ts

test/integration/
└── lab-flow-admin.integration-spec.ts
```

**Structure Decision**: Keep operator HTTP under `src/modules/admin/`. Own flow persistence entities/repos in `src/modules/labs/` (same feature boundary as learner summary). Do not put curriculum columns on `labs` catalog table — separate 1:1 curriculum row keeps catalog CRUD from 021 unchanged and allows “no curriculum yet → 404 summary”.

## Complexity Tracking

No constitution violations requiring justification.
