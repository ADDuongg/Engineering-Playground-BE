# Tasks: Track Registry

**Input**: Design documents from `/specs/001-track-registry/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared types and module scaffold

- [x] T001 [P] Add Track shared enums and DTOs in `src/shared/tracks/` and export from `src/shared/index.ts`
- [x] T002 Create `src/modules/tracks/` module scaffold (`tracks.module.ts`, empty controller)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and repository — MUST complete before user stories

- [x] T003 Create `TrackEntity` in `src/modules/tracks/entities/track.entity.ts`
- [x] T004 Create migration `src/database/migrations/1730100000000-InitTracksTable.ts` with enums, table, and seed data
- [x] T005 Implement `TrackRepository` in `src/modules/tracks/infrastructure/track.repository.ts`
- [x] T006 Implement `TrackMapper` in `src/modules/tracks/mappers/track.mapper.ts`
- [x] T007 Register `TracksModule` in `src/app.module.ts`

**Checkpoint**: Foundation ready — user story work can begin

---

## Phase 3: User Story 1 — Discover Available Learning Tracks (P1) 🎯 MVP

**Goal**: Public `GET /tracks` returns ordered catalog with seeded Tracks

**Independent Test**: `curl /tracks` returns 3 Tracks; `database-sql` is first and `active`

### Tests for User Story 1

- [x] T008 [P] [US1] Unit test `list-tracks.usecase.spec.ts`
- [x] T009 [P] [US1] Integration test list endpoint in `test/integration/tracks.e2e-spec.ts`

### Implementation for User Story 1

- [x] T010 [US1] Implement `ListTracksUseCase` in `src/modules/tracks/application/list-tracks.usecase.ts`
- [x] T011 [US1] Add `GET /tracks` handler in `src/modules/tracks/tracks.controller.ts` with `@Public()`

**Checkpoint**: User Story 1 independently testable

---

## Phase 4: User Story 2 — Resolve Track Configuration (P1)

**Goal**: `GET /tracks/:slug` returns full config with `isLabStartable`

**Independent Test**: `curl /tracks/database-sql` returns adapter config; unknown slug returns 404

### Tests for User Story 2

- [x] T012 [P] [US2] Unit test `get-track-by-slug.usecase.spec.ts`
- [x] T013 [P] [US2] Integration tests detail + 404 in `test/integration/tracks.e2e-spec.ts`

### Implementation for User Story 2

- [x] T014 [P] [US2] Create `track-slug.param.dto.ts` with slug validation
- [x] T015 [US2] Implement `GetTrackBySlugUseCase` in `src/modules/tracks/application/get-track-by-slug.usecase.ts`
- [x] T016 [US2] Add `GET /tracks/:slug` handler in `tracks.controller.ts`

**Checkpoint**: User Stories 1 and 2 complete

---

## Phase 5: User Story 3 — Platform Maintains Authoritative Catalog (P2)

**Goal**: Verify Platform DB persistence and seed integrity

**Independent Test**: Migration seeds 3 rows; entity uses `platform` connection

### Implementation for User Story 3

- [x] T017 [US3] Verify migration seed idempotency and document in quickstart (no code change if T004 correct)
- [x] T018 [US3] Add integration assertion that list count ≥ 3 after migration

**Checkpoint**: All user stories complete

---

## Phase 6: Polish & Cross-Cutting

- [x] T019 [P] Swagger `@ApiTags` and `@ApiOperation` on track endpoints
- [x] T020 Run full test suite and quickstart validation
- [x] T021 Update BACKLOG.md status to `Implementing` → `Review` and checklist items

---

## Dependencies & Execution Order

```text
T001, T002 → T003 → T004 → T005, T006 → T007
  → T008–T011 (US1) → T012–T016 (US2) → T017–T018 (US3) → T019–T021
```

## Parallel Opportunities

- T001 and T002 can run in parallel
- T008/T009 parallel; T012/T013 parallel
- T014 parallel with T012

## MVP Scope

Complete through **Phase 3** (User Story 1) for minimal viable Track discovery; Phases 4–6 complete the feature per spec.
