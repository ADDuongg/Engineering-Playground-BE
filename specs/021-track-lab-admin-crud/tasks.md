# Tasks: Track & Lab Admin CRUD

**Input**: Design documents from `/specs/021-track-lab-admin-crud/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included (constitution requires unit + integration; quickstart scenarios)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story label (`[US1]`…`[US5]`)
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared enums/contracts and admin module wiring for catalog writes

- [x] T001 [P] Add `LabStatus` enum in `src/shared/tracks/lab-status.enum.ts` and export from `src/shared/index.ts`
- [x] T002 [P] Add `VisualizationKitId` enum in `src/shared/tracks/visualization-kit-id.enum.ts` (database-viz, redis-viz, react-viz) and export from `src/shared/index.ts`
- [x] T003 [P] Extend `MetricCatalogId` in `src/shared/metrics/metric-catalog-id.enum.ts` with `redis-metrics` and `react-metrics`
- [x] T004 [P] Add admin shared types (`AdminTrackView`, `CreateTrackRequest`, `UpdateTrackRequest`, `AdminLabView`, `CreateLabRequest`, `UpdateLabRequest`) in `src/shared/tracks/track-admin.ts` (or split track/lab files) and export from `src/shared/index.ts`
- [x] T005 [P] Extend `LabPathItem` / progress lab types with `status: LabStatus` in `src/shared/progress/progress-responses.ts`
- [x] T006 Import `TracksModule` and `ProgressModule` into `src/modules/admin/admin.module.ts` (prepare for catalog controllers/usecases)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Lab status persistence + repository write primitives shared by all stories

**CRITICAL**: No user story work until this phase completes

- [x] T007 Add `status` column to `LabEntity` in `src/modules/progress/entities/lab.entity.ts` using `LabStatus`
- [x] T008 Create migration `src/database/migrations/1730700000000-AddLabStatusAndBackfill.ts` (enum/column, backfill existing labs to `active`, register in `src/database/platform/data-source.ts` and `platform-database.module.ts` if needed)
- [x] T009 Extend `TrackRepository` in `src/modules/tracks/infrastructure/track.repository.ts` with create/update helpers (preserve `findAllOrdered` / `findBySlug`)
- [x] T010 Extend `LabRepository` in `src/modules/progress/infrastructure/lab.repository.ts` with create/update helpers (preserve ordered finds by track)
- [x] T011 [P] Add Track config identifier validator (known `RuntimeAdapterType` / `InputSurfaceType` / `MetricCatalogId` / `VisualizationKitId`) in `src/modules/admin/application/track-config.validator.ts` (or infrastructure) returning `DomainError(VALIDATION_ERROR)` with field details
- [x] T012 Update `ProgressMapper` in `src/modules/progress/mappers/progress.mapper.ts` to map `lab.status` onto learner path/progress items

**Checkpoint**: Schema + write repos + config validation + learner status mapping foundation ready

---

## Phase 3: User Story 1 — Admin Creates and Updates Tracks (P1) MVP

**Goal**: Admin can create/update Tracks on Platform DB with defaults and config validation

**Independent Test**: Admin creates Track (omit status → coming-soon), patches to active, non-admin gets 403; learner `GET /tracks` reflects change

### Tests for User Story 1

- [x] T013 [P] [US1] Unit tests for create/update Track use cases (default status, duplicate slug CONFLICT, unknown viz kit VALIDATION_ERROR) in `src/modules/admin/application/create-track.usecase.spec.ts` and `update-track.usecase.spec.ts`
- [x] T014 [P] [US1] Integration cases: admin create/update Track + non-admin 403 in `test/integration/track-lab-admin.integration-spec.ts`

### Implementation for User Story 1

- [x] T015 [P] [US1] Add Track admin DTOs (create/update/param) in `src/modules/admin/dto/`
- [x] T016 [US1] Implement `CreateTrackUseCase` in `src/modules/admin/application/create-track.usecase.ts` (omit status → coming-soon; slug unique; config validate; no playground writes)
- [x] T017 [US1] Implement `UpdateTrackUseCase` in `src/modules/admin/application/update-track.usecase.ts` (slug immutable; reject unknown config)
- [x] T018 [US1] Implement `AdminTracksController` routes `POST /admin/tracks` and `PATCH /admin/tracks/:slug` in `src/modules/admin/admin-tracks.controller.ts` with `@Roles(Role.ADMIN)`
- [x] T019 [US1] Register US1 providers in `src/modules/admin/admin.module.ts` and make T013/T014 pass

**Checkpoint**: US1 Track write path independently testable

---

## Phase 4: User Story 2 — Admin Creates and Updates Labs Under a Track (P1)

**Goal**: Admin can create/update Labs under an existing Track with status default and immutable slug/track

**Independent Test**: Admin creates Lab under Track (omit status → coming-soon), updates title/order/status; missing Track → 404; non-admin → 403

### Tests for User Story 2

- [x] T020 [P] [US2] Unit tests for create/update Lab use cases in `src/modules/admin/application/create-lab.usecase.spec.ts` and `update-lab.usecase.spec.ts`
- [x] T021 [P] [US2] Integration cases: admin create/update Lab, missing Track 404, duplicate slug 409 in `test/integration/track-lab-admin.integration-spec.ts`

### Implementation for User Story 2

- [x] T022 [P] [US2] Add Lab admin DTOs in `src/modules/admin/dto/`
- [x] T023 [US2] Implement `CreateLabUseCase` in `src/modules/admin/application/create-lab.usecase.ts` (parent Track required; omit status → coming-soon)
- [x] T024 [US2] Implement `UpdateLabUseCase` in `src/modules/admin/application/update-lab.usecase.ts` (no slug/track change; duplicate sequence_order allowed)
- [x] T025 [US2] Implement `AdminLabsController` routes `POST /admin/tracks/:trackSlug/labs` and `PATCH /admin/labs/:labSlug` in `src/modules/admin/admin-labs.controller.ts`
- [x] T026 [US2] Register US2 providers and make T020/T021 pass

**Checkpoint**: US1 + US2 catalog writes work

---

## Phase 5: User Story 3 — Admin Lists and Inspects Catalog Metadata (P1)

**Goal**: Admin list/get Tracks and Labs with stable ordering and full metadata

**Independent Test**: Admin lists Tracks (displayOrder, name) and Labs for a Track (sequenceOrder, slug); unknown slug → 404

### Tests for User Story 3

- [x] T027 [P] [US3] Unit tests for list/get admin Track/Lab use cases in `src/modules/admin/application/*.spec.ts`
- [x] T028 [P] [US3] Integration cases for admin list/get + 404 in `test/integration/track-lab-admin.integration-spec.ts`

### Implementation for User Story 3

- [x] T029 [P] [US3] Implement `ListAdminTracksUseCase` and `GetAdminTrackUseCase` in `src/modules/admin/application/`
- [x] T030 [P] [US3] Implement `ListAdminLabsUseCase` and `GetAdminLabUseCase` in `src/modules/admin/application/`
- [x] T031 [US3] Wire `GET /admin/tracks`, `GET /admin/tracks/:slug`, `GET /admin/tracks/:trackSlug/labs`, `GET /admin/labs/:labSlug` on admin controllers
- [x] T032 [US3] Make T027/T028 pass

**Checkpoint**: Full admin CRUD-without-delete (create/update/list/get) complete

---

## Phase 6: User Story 4 — Learner Catalog Continues Reading Shared Platform Tables (P1)

**Goal**: Learner Track/Lab readers use the same Platform rows; coming-soon Labs appear with status; start/summary gated; playground reset does not touch catalog

**Independent Test**: After admin create/update, public Track list and learning-path show changes with `status`; coming-soon Lab summary → 403; seeded labs remain active

### Tests for User Story 4

- [x] T033 [P] [US4] Unit tests: learning-path/progress include lab status; get-lab-summary / complete-lab forbid non-active lab in existing `*.usecase.spec.ts` files under `src/modules/progress/` and `src/modules/labs/`
- [x] T034 [P] [US4] Integration: admin publish Track/Lab → learner path shows status; coming-soon summary 403; existing `index-playground` still active in `test/integration/track-lab-admin.integration-spec.ts`

### Implementation for User Story 4

- [x] T035 [US4] Gate `GetLabSummaryUseCase` in `src/modules/labs/application/get-lab-summary.usecase.ts` on `lab.status === active` (in addition to Track status)
- [x] T036 [US4] Gate `CompleteLabUseCase` (and any other lab-start paths that check Track status) on Lab `active` in `src/modules/progress/application/complete-lab.usecase.ts`
- [x] T037 [US4] Ensure learning-path / track-progress use cases return `status` via mapper (verify `get-learning-path.usecase.ts` / `get-track-progress.usecase.ts`)
- [x] T038 [US4] Make T033/T034 pass

**Checkpoint**: Shared catalog + learner visibility/gating verified

---

## Phase 7: User Story 5 — Admin Soft-Hides Catalog Items via Status (P2)

**Goal**: Soft-hide via status only; no DELETE; completions preserved

**Independent Test**: PATCH Lab/Track to coming-soon; row remains; completions intact; start/summary blocked; no DELETE route exists

### Tests for User Story 5

- [x] T039 [P] [US5] Integration: soft-hide Lab with prior completion → path still lists lab as coming-soon; complete/summary 403; assert no DELETE admin routes in `test/integration/track-lab-admin.integration-spec.ts`

### Implementation for User Story 5

- [x] T040 [US5] Confirm admin controllers expose no DELETE handlers; document soft-hide-only in Swagger operation notes on PATCH status
- [x] T041 [US5] Make T039 pass (reuse update use cases; add assertions only if gaps)

**Checkpoint**: Soft-hide behavior complete; hard delete explicitly absent

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Docs, backlog, quickstart validation

- [x] T042 [P] Align README short pointer (if needed) to admin catalog quickstart in `README.md`
- [x] T043 Update `docs/product/BACKLOG.md` Track & Lab Admin CRUD checklist/notes when implementation+tests done (Status → Review/Done as appropriate)
- [x] T044 Run `specs/021-track-lab-admin-crud/quickstart.md` scenarios manually or via e2e; fix gaps
- [x] T045 [P] Add Spec Index note already present; ensure `contracts/track-lab-admin-api.md` matches shipped routes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Start immediately
- **Phase 2 Foundational**: After Setup — **blocks all user stories**
- **US1 → US2 → US3**: Prefer sequential (US2 needs Tracks; US3 needs entities written)
- **US4**: After US2 at minimum (needs Lab status + admin writes to verify); can start gating after T007–T012
- **US5**: After US2 + US4 gating
- **Polish**: After desired stories complete

### User Story Dependencies

- **US1**: After Phase 2
- **US2**: After Phase 2 (Track must exist — can use seeded Track)
- **US3**: After US1/US2 write paths (or after Phase 2 using seeds only for list)
- **US4**: After Lab status foundation + preferably US2
- **US5**: After US2 + US4

### Parallel Opportunities

- T001–T005 in parallel
- T013/T014 after use case stubs or with TDD
- T029/T030 list/get use cases in parallel
- T033/T034 tests in parallel once gating implemented

---

## Parallel Example: Foundational

```text
T001 LabStatus enum
T002 VisualizationKitId enum
T003 MetricCatalogId extend
T004 Admin shared types
T005 LabPathItem.status
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 + Phase 2
2. Phase 3 US1 (Track create/update)
3. Stop and validate with admin token + learner Track list

### Incremental Delivery

1. US1 Tracks write
2. US2 Labs write
3. US3 Admin list/get
4. US4 Learner status visibility + gating
5. US5 Soft-hide confirmation + polish

### Suggested MVP scope

US1 + foundational Lab status migration (even if Lab writes follow immediately in US2).

---

## Notes

- No hard delete endpoints
- Create omit status → `coming-soon`; existing labs backfilled `active`
- Duplicate `sequence_order` allowed; sort `(sequenceOrder, slug)`
- All admin routes under `/api/v1/admin/*` with `@Roles(Role.ADMIN)`
- Commit after each task or logical group when asked
