# Research: Dataset Loader

**Feature**: 003-dataset-loader | **Date**: 2026-07-08

## 1. Seed Artifact Storage

**Decision**: Store dataset definitions as version-controlled SQL files under `seeds/datasets/{family}/{version}/` plus a top-level `manifest.json` describing families, tiers, table catalogs, and target row counts.

**Rationale**: PRD §14 requires platform-provided datasets with no user uploads. File-based seeds are reproducible, reviewable in PRs, and do not require platform DB migrations for each dataset revision. Manifest gives labs structured metadata without parsing SQL.

**Alternatives considered**:
- **Platform DB tables for seed blobs**: Adds migration overhead for every dataset tweak; rejected for MVP.
- **Runtime CSV import**: Slower for large tiers; harder to version; rejected.
- **Docker volume snapshots**: Opaque, hard to diff; rejected.

## 2. Data Generation Strategy

**Decision**: Use PostgreSQL-native bulk generation in seed SQL (`generate_series`, `INSERT … SELECT`) for scalable row creation. Schema file creates tables + indexes baseline; tier files populate data to documented counts.

**Rationale**: Server-side generation avoids shipping large static dumps in git. `generate_series` is fast enough for 100K in seconds and 1M in tens of seconds on dev hardware. Same scripts remain deterministic via fixed seeds (`setseed()` where randomness needed).

**Alternatives considered**:
- **Checked-in .sql dump files**: Huge repo size at 10M tier; rejected.
- **Application-layer row loop**: Slow, memory-heavy; rejected.

## 3. Preparation Execution Model

**Decision**: `DatasetSeedRunner` executes `schema.sql` then tier-specific `seed-{tier}.sql` in a single playground transaction where practical; on failure, roll back and mark status `failed`. 100K tier runs synchronously in the HTTP request path. 1M and 10M tiers enqueue in-process async work and return `preparing` immediately; client polls status via Redis-backed store.

**Rationale**: Meets SC-002 for 100K interactive UX. Avoids HTTP timeout on large tiers without waiting for BullMQ infrastructure. Redis already exists in the stack for status persistence across instances.

**Alternatives considered**:
- **Always synchronous**: Violates FR-010 and constitution for large tiers; rejected.
- **BullMQ now**: Worker Queue Foundation not done; deferred with documented migration path.
- **Skip 1M/10M in MVP**: Backlog explicitly requires all tiers; rejected.

## 4. Idempotency and Re-preparation

**Decision**: Before seeding, runner drops and recreates the commerce schema objects defined in `schema.sql` (scoped `DROP TABLE IF EXISTS … CASCADE` for known tables only). Preparation for the same `{family, version, tier}` while `preparing` returns existing job status (no duplicate workers).

**Rationale**: Guarantees deterministic state (FR-005) and prevents partial-load confusion. Scoped drops avoid touching unrelated playground objects. Dedup protects shared infrastructure under concurrent lab opens.

**Alternatives considered**:
- **Append-only seeding**: Risks duplicate rows on re-run; rejected.
- **TRUNCATE only**: Fails when schema drifts between versions; rejected.

## 5. Metadata Exposure

**Decision**: `GetDatasetMetadataUseCase` reads manifest + live `COUNT(*)` from playground tables when status is `ready`; returns structured catalog (tables, descriptions, row counts, tier, version, readiness).

**Rationale**: Satisfies FR-006 and US3. Manifest supplies educational descriptions; live counts verify load success within 1% tolerance (SC-003).

**Alternatives considered**:
- **Manifest counts only**: Cannot detect partial failures; rejected as sole source.
- **information_schema only**: No human descriptions; rejected.

## 6. Version Pinning

**Decision**: Manifest lists available versions per family; labs reference `{ family, version, tier }` triple. Default version `v1` used when lab config omits version. Unknown version returns `VALIDATION_ERROR` with educational message.

**Rationale**: Supports FR-004 reproducibility without a separate registry service in MVP.

**Alternatives considered**:
- **Single implicit version**: No upgrade path; rejected for long-term lab stability.

## 7. HTTP API Surface

**Decision**: Expose REST endpoints under `/datasets`:
- `POST /datasets/prepare` — trigger preparation
- `GET /datasets/metadata` — query metadata by `family`, `version`, `tier` query params
- `GET /datasets/prepare/status` — poll readiness by same identity keys

**Rationale**: Lab shells and future Experiment Runner need HTTP contract. Follows existing NestJS controller patterns (tracks, auth, sql-sandbox).

**Alternatives considered**:
- **Internal module only**: Blocks lab shell integration; rejected.

## 8. Configuration

**Decision**: Add optional `dataset.loader.syncTierMax` (default `100k`) and `dataset.loader.preparationTtlSeconds` (default `3600`) to configuration. Manifest path defaults to `seeds/datasets/manifest.json` relative to project root.

**Rationale**: Operators can tune sync/async boundary without code changes when hardware improves.

**Alternatives considered**:
- **Hard-coded tier behavior**: Less flexible; rejected.
