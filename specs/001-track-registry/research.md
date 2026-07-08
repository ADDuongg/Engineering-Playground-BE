# Research: Track Registry

**Feature**: 001-track-registry | **Date**: 2026-07-08

## Decision 1: Storage location

**Decision**: Store `tracks` table on Platform PostgreSQL via existing `platform` TypeORM connection.

**Rationale**: Constitution principle VI requires Tracks on permanent Platform DB, separate from disposable playground state. Auth module already uses this pattern (`TypeOrmModule.forFeature(..., 'platform')`).

**Alternatives considered**:
- JSON config files — rejected: not queryable, no migration discipline, harder for future admin APIs
- Playground PostgreSQL — rejected: violates platform/runtime separation

## Decision 2: Catalog population strategy

**Decision**: Seed Tracks via TypeORM migration with `INSERT` statements (idempotent upsert on slug).

**Rationale**: Spec assumes seed-driven MVP with no admin CRUD. Migrations are the project's mandated schema change mechanism (constitution).

**Alternatives considered**:
- Runtime seed script — rejected: duplicates migration responsibility, less reproducible across environments
- Admin API — rejected: out of scope per spec assumptions

## Decision 3: Metric catalog and visualization kit references

**Decision**: Store stable string identifiers on the Track row (`metric_catalog_id`, `visualization_kit_id`). Full catalog definitions live in code constants under `src/shared/tracks/catalogs/` for MVP.

**Rationale**: Registry resolves *which* catalog applies; catalog content is Track-domain configuration consumed by Metrics Pipeline and Lab Shell later. Avoids bloating registry with JSON blobs.

**Alternatives considered**:
- Separate `metric_catalogs` tables — rejected: YAGNI for MVP; only references needed now
- Inline JSON on Track — rejected: harder to version and validate

## Decision 4: Public vs authenticated access

**Decision**: Mark both Track endpoints `@Public()` — same response for all callers.

**Rationale**: Spec FR-008 and Track Browser/Landing Page discovery require unauthenticated catalog access. No sensitive data in Track metadata.

**Alternatives considered**:
- Auth required — rejected: blocks pre-login discovery
- Different payloads per auth — rejected: unnecessary complexity

## Decision 5: Runtime adapter and input surface typing

**Decision**: Use PostgreSQL enums (mirrored in TypeScript shared enums) for `runtime_adapter_type` and `input_surface_type`.

**Rationale**: Prevents invalid combinations at DB level; shared enums keep API contracts stable. MVP values: `playground_postgresql`, `playground_redis`, `headless_react_sandbox`; input surfaces: `sql_editor`, `command_panel`, `component_sandbox`.

**Alternatives considered**:
- Free-form varchar — rejected: allows typos and inconsistent downstream resolution
- FK to lookup tables — rejected: over-engineering for small fixed set

## Decision 6: Coming-soon Track behavior

**Decision**: Return full Track detail including `status: coming-soon`; consumers (Lab Browser, Lab Shell) gate lab entry — registry does not block detail reads.

**Rationale**: Track Browser needs metadata for coming-soon cards. Blocking detail would prevent UI from showing future Tracks. Lab-start gating is consumer responsibility per FR-010.

**Alternatives considered**:
- Hide coming-soon from detail endpoint — rejected: contradicts list visibility requirement
- 403 on coming-soon detail — rejected: prevents discovery UI
