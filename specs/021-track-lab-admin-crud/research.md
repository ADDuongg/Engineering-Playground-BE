# Research: Track & Lab Admin CRUD

**Feature**: `021-track-lab-admin-crud` | **Date**: 2026-07-12

## R1 — Module placement for admin catalog APIs

**Decision**: Add `AdminTracksController` and `AdminLabsController` under existing `src/modules/admin/`, class-level `@Roles(Role.ADMIN)`. Persist through exported `TrackRepository` / `LabRepository` from TracksModule and ProgressModule.

**Rationale**: Admin AuthZ already established `/admin` namespace; keeps learner controllers free of mutations (FR-015); repositories remain the single Platform catalog source (FR-010/011).

**Alternatives considered**:

- Write endpoints on `TracksController` / `ProgressController` with role checks — mixes learner discovery with operator writes
- New top-level `catalog-admin` module with its own repositories — duplicates entities and violates single catalog store

## R2 — Lab status model and backfill

**Decision**: Add `LabStatus` enum (`active` | `coming-soon`) as a Platform DB column on `labs`, default on create when omitted = `coming-soon`. Migration backfills all existing rows to `active`.

**Rationale**: Spec clarifications (create default coming-soon; existing labs stay startable). Mirrors TrackStatus vocabulary for operators and FE.

**Alternatives considered**:

- Soft-delete boolean — weaker parity with Track catalog language
- Backfill to coming-soon — would break Index Playground until republish (rejected)

## R3 — Learner visibility of coming-soon Labs

**Decision**: Include Labs of any status in learning-path and track-progress responses with `status` field. Block lab summary and lab completion (and any start path that already checks track status) when Lab is not `active`.

**Rationale**: Clarification A — preview upcoming curriculum while preventing premature entry. Aligns with Track catalog showing coming-soon Tracks.

**Alternatives considered**:

- Hide coming-soon from learner lists — operators lose preview; rejected
- Show in path but omit from progress — inconsistent UX; rejected

## R4 — Sequence order uniqueness

**Decision**: Do not enforce unique `(track_id, sequence_order)`. Always order by `sequence_order ASC, slug ASC` (already used by `LabRepository`).

**Rationale**: Clarification B; avoids reorder races; matches Track `display_order` looseness.

**Alternatives considered**:

- Unique constraint + reject — brittle for concurrent edits
- Auto-renumber on conflict — extra complexity; deferred to Lab Flow Admin reorder if needed

## R5 — Known Track config identifier sets

**Decision**: Validate all four Track config fields against shared enums/constants:

| Field | Known set |
|-------|-----------|
| runtimeAdapterType | `RuntimeAdapterType` (existing) |
| inputSurfaceType | `InputSurfaceType` (existing) |
| metricCatalogId | `MetricCatalogId` — extend to cover seeded `database-metrics`, `redis-metrics`, `react-metrics` |
| visualizationKitId | New `VisualizationKitId` enum — `database-viz`, `redis-viz`, `react-viz` (from seeds) |

Reject unknown values with `VALIDATION_ERROR` and field details.

**Rationale**: Clarification — prevent Tracks learners cannot run / FE cannot render. Extending enums is the ship vehicle for new kits.

**Alternatives considered**:

- Free-form metric/viz strings — allows broken configs (rejected)
- DB-backed kit registry table — overkill for MVP known set

## R6 — Slug immutability and no hard delete

**Decision**: Slug set only on create; updates reject slug changes (ignore or 400 if sent). No DELETE endpoints; soft-hide via status only. Lab `trackId` immutable after create.

**Rationale**: Spec FR-002/005/013; protects progress/quiz FKs and FE deep links.

**Alternatives considered**:

- Slug rename with redirects — out of scope
- Hard delete with RESTRICT — deferred until product rules clear

## R7 — Error and conflict patterns

**Decision**: Use `DomainError` with `NOT_FOUND` (404), `CONFLICT` (409 duplicate slug), `VALIDATION_ERROR` (400 unknown config / invalid fields), `FORBIDDEN` (403 non-active lab start/summary). AuthZ remains Nest `UnauthorizedException` / `ForbiddenException` via guards.

**Rationale**: Matches Register / Track / Lab summary patterns already in codebase.

## R8 — Shared contracts for admin responses

**Decision**: Add admin-oriented shared types in `src/shared/tracks/` (create/update payloads + admin track/lab views). Extend `LabPathItem` with `status: LabStatus` for learner surfaces (additive, non-breaking for FE that ignores unknown fields; document in contract).

**Rationale**: Constitution — shared contracts in `src/shared`; avoid module-private response shapes for FE-facing payloads.

**Alternatives considered**:

- Admin-only types living only in module DTOs without shared export — drifts from FE contract ownership
- Separate learner DTO without status until FE ready — would violate FR-018 visibility requirement

## R9 — Migration registration

**Decision**: New migration `1730700000000-AddLabStatusAndBackfill` creating Postgres enum (or check/varchar aligned with TrackStatus style), column `labs.status NOT NULL DEFAULT 'active'`, backfill `UPDATE labs SET status = 'active'`, then alter default to `'coming-soon'` for future inserts if desired — or keep DB default `active` and apply coming-soon default only in application create use case.

**Rationale**: Application-level default for omitted status matches clarification without changing insert semantics for any raw SQL seeds that omit status. Prefer: column NOT NULL, backfill active, DB default `active` for safety; UseCase sets `coming-soon` when request omits status.

**Alternatives considered**:

- DB default `coming-soon` — risks accidental coming-soon on any seed INSERT that omits status; Prefer UseCase default
