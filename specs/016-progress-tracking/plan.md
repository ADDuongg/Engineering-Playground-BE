# Implementation Plan: Progress Tracking

**Branch**: `016-progress-tracking` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-progress-tracking/spec.md`

## Summary

Add Platform DB lab catalog + per-user lab completion registry with APIs for: public learning path by Track, authenticated self-complete (idempotent), and authenticated Track progress summary. Emit `lab.completed` / progress domain events via EventEmitter2 for Quiz Engine and others. Seed MVP Database / SQL labs via migration only (no admin CRUD, no revoke).

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM, `@nestjs/event-emitter`, existing JWT auth (`JwtAuthGuard` / `@Public`), Jest + Supertest

**Storage**: Platform PostgreSQL — `labs` + `user_lab_completions` tables; **not** playground DB; Redis not used as source of truth

**Testing**: Unit tests (UseCases: complete idempotency, progress summary math, path ordering, auth rejects); integration tests (migration seed, complete → read, public path, playground reset does not wipe completions)

**Target Platform**: NestJS API (single process; no worker required)

**Project Type**: Backend web service (Learning Platform feature module)

**Performance Goals**: Completion reflected on subsequent progress read within 1s (SC-001); path order stable

**Constraints**: BE-only APIs; public path without completion flags; auth for complete + progress; globally unique lab slugs; complete-only; seed-only catalog; quiz gating out of scope

**Scale/Scope**: MVP ~4 seeded labs on `database-sql`; one completion row per user×lab; flat path per Track

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared progress/lab types in `src/shared/progress/` (or `src/shared/labs/`)
- [x] **Feature-first backend**: Controller → UseCase → Repository; events for cross-feature
- [x] **TypeScript strict**: Typed entities, DTOs, event payloads; no unjustified `any`
- [x] **Testing**: Unit + integration planned; auth and idempotency covered
- [x] **Learning UX**: Clear not-found / unauthorized / coming-soon Track errors for FE
- [x] **Platform vs Playground**: Completions + labs on Platform DB only; unaffected by dataset reset
- [x] **Simplicity**: No Redis cache for MVP; no admin CRUD; no worker; EventEmitter2 like BenchmarkFinished

**Post-design note**: Minimal Lab catalog is introduced here (Track Registry has Tracks only). Lab CRUD deferred to seeds/migrations, matching Tracks.

## Project Structure

### Documentation (this feature)

```text
specs/016-progress-tracking/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/progress-tracking-service.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
src/shared/progress/
├── lab-summary.ts                 # public path item
├── track-learning-path.ts
├── track-progress-summary.ts
├── complete-lab-result.ts
├── lab-completed.event.ts         # LAB_COMPLETED_EVENT + payload
└── index.ts

src/modules/progress/
├── progress.module.ts
├── progress.controller.ts         # path (public), progress (auth), complete (auth)
├── application/
│   ├── get-learning-path.usecase.ts
│   ├── get-track-progress.usecase.ts
│   ├── complete-lab.usecase.ts
│   └── *.spec.ts
├── infrastructure/
│   ├── lab.repository.ts
│   ├── user-lab-completion.repository.ts
│   └── *.spec.ts (optional if covered via use cases)
├── entities/
│   ├── lab.entity.ts
│   └── user-lab-completion.entity.ts
├── dto/
│   ├── track-slug.param.dto.ts    # reuse pattern from tracks
│   └── lab-slug.param.dto.ts
└── mappers/
    └── progress.mapper.ts

src/database/migrations/
└── 1730400000000-CreateLabsAndUserLabCompletions.ts   # tables + seed MVP labs

src/app.module.ts                  # register ProgressModule

test/integration/
└── progress-tracking.integration-spec.ts
```

**Structure Decision**: New `ProgressModule` owns lab catalog reads + completions (single Learning Platform concern). Reuse Track lookup via `TrackRepository` / existing tracks module export rather than duplicating Track entity logic. No FE package changes.

## Complexity Tracking

> No constitution violations requiring justification. Lab catalog is a new Platform entity but is required by the spec and is the minimal data needed for path/progress.
