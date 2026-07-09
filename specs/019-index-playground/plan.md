# Implementation Plan: Index Playground

**Branch**: `019-index-playground` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-index-playground/spec.md`

## Summary

Ship Database Track Lab 1 (Index Playground) as backend curriculum + wiring: authenticated **lab summary** API with guided steps and canonical `users.email` query / index DDL; reuse Experiment Runner (SQL create/drop index), Explain Runner (primary scan/rows metrics), Metrics Pipeline, Dataset Loader, and Quiz Engine. No FE, no Redis, no new benchmark APIs; benchmark mention optional/P2.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM (Lab/Track reads), existing JWT auth, Experiment Runner, Explain Runner, Metrics Pipeline, Dataset Loader, Quiz Engine, Jest + Supertest

**Storage**: Platform PostgreSQL — existing `labs` / `tracks` / quiz tables only; lab summary content in-repo (not a new table). Playground PostgreSQL — disposable indexes via sandboxed DDL

**Testing**: Unit tests for summary UseCase/content; integration for `GET /labs/:labSlug/summary`; optional slow integration for explain before/after scan metrics on commerce tier

**Target Platform**: NestJS API

**Project Type**: Backend web service (Database Track lab feature)

**Performance Goals**: Summary read fast (static content); explain before/after comparison reliable on ≥100k tier (SC-001/SC-002)

**Constraints**: BE-only; auth on summary; SQL-only index DDL; Explain-primary scan metrics; no FE/Redis; benchmark not a P1 gate

**Scale/Scope**: One lab (`index-playground`); reusable summary shape for future labs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared lab summary types in `src/shared/labs/`
- [x] **Feature-first backend**: Controller → UseCase → content registry / LabRepository; no forbidden deps
- [x] **TypeScript strict**: Typed summary DTOs; no unjustified `any`
- [x] **Testing**: Unit + integration planned; explain comparison covered where environment allows
- [x] **Learning UX**: Guided steps + educational errors via existing runners; metrics from backend only
- [x] **Platform vs Playground**: Summary/quiz on Platform; indexes disposable on Playground
- [x] **Simplicity**: No CMS, no new benchmark stack, no duplicate DDL APIs; reuse runners

**Post-design note**: “Scan type” in the product sense maps to existing `seq_scan_used` / `index_scan_used` (+ plan nodes)—no mandatory new catalog key.

## Project Structure

### Documentation (this feature)

```text
specs/019-index-playground/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/index-playground-service.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
src/shared/labs/
├── lab-summary.ts              # LabSummaryResponse, LabGuidedStep, GuidedSql types
└── index.ts

src/modules/labs/
├── labs.module.ts
├── labs.controller.ts          # GET /labs/:labSlug/summary
├── application/
│   ├── get-lab-summary.usecase.ts
│   └── get-lab-summary.usecase.spec.ts
├── infrastructure/
│   ├── lab-summary.content.ts  # index-playground curriculum constants
│   └── lab-summary.registry.ts # slug → content
├── dto/
│   └── lab-slug.param.dto.ts   # or reuse progress pattern
└── mappers/
    └── lab-summary.mapper.ts

# Reuse (no ownership transfer)
src/modules/progress/…          # LabRepository / track status
src/modules/experiment-runner/…
src/modules/explain-runner/…
src/modules/metrics-pipeline/…  # explain metrics already include scan keys
src/modules/quiz/…              # existing index-playground quiz
src/modules/dataset-loader/…

src/app.module.ts               # register LabsModule

test/integration/
└── index-playground.integration-spec.ts  # summary + optional explain loop
```

**Structure Decision**: New `LabsModule` owns lab summary only. All experiment/explain/dataset/quiz/benchmark behavior stays in existing modules; Index Playground is content + contract documentation + tests proving the loop.

## Complexity Tracking

> No constitution violations. Cross-module reads of `LabRepository` (Progress) for slug/track validation mirror Quiz Engine patterns.
