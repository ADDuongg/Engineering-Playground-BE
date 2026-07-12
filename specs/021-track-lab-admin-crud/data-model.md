# Data Model: Track & Lab Admin CRUD

**Feature**: `021-track-lab-admin-crud` | **Date**: 2026-07-12

Platform DB only. No playground tables.

## Track (existing — write path added)

Table: `tracks` (unchanged schema). Admin create/update/list/get use this table; learner `GET /tracks` continues to read it.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | Stable id |
| slug | varchar(64) | unique, immutable after create | URL key |
| name | varchar(120) | required | |
| description | text | required | |
| status | enum | `active` \| `coming-soon` | Create omit → app default `coming-soon` |
| display_order | int | default 0 | Duplicates allowed; sort order then name |
| runtime_adapter_type | enum | known `RuntimeAdapterType` | Validated |
| input_surface_type | enum | known `InputSurfaceType` | Validated |
| metric_catalog_id | varchar(64) | known `MetricCatalogId` | Validated against enum values |
| visualization_kit_id | varchar(64) | known `VisualizationKitId` | Validated against new enum |
| created_at / updated_at | timestamptz | | |

### Track validation

- Slug: required on create; URL-safe pattern (lowercase alphanumeric + hyphens); unique → `CONFLICT` on duplicate
- Status: optional on create (default `coming-soon`); required values only `active` | `coming-soon` on update
- Config fields: must be members of known platform identifier sets → else `VALIDATION_ERROR`
- Update must not change slug

### Track state transitions

| From | Event | To |
|------|-------|----|
| (none) | Admin create (omit status) | `coming-soon` |
| (none) | Admin create (status=active) | `active` |
| `coming-soon` | Admin update status | `active` |
| `active` | Admin update status | `coming-soon` (soft-hide) |

No hard delete.

---

## Lab (extended)

Table: `labs` — **add** `status`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| slug | varchar(128) | unique, immutable after create | |
| title | varchar(200) | required | |
| description | text | nullable | |
| track_id | uuid | FK → tracks, RESTRICT, immutable after create | |
| sequence_order | int | required; **not** unique per track | Sort with slug |
| status | enum | `active` \| `coming-soon` | **NEW** |
| created_at / updated_at | timestamptz | | |

### Migration

1. Create `labs_status_enum` (or reuse pattern consistent with `tracks_status_enum`).
2. Add `status` column NOT NULL with temporary default `active`.
3. Backfill: `UPDATE labs SET status = 'active'` (explicit; satisfies FR-020).
4. Keep DB default `active` for raw inserts; application create use case sets `coming-soon` when request omits status.

### Lab validation

- Parent Track must exist → else `NOT_FOUND`
- Slug unique globally (existing unique constraint) → `CONFLICT`
- Sequence order: integer; duplicates allowed
- Status omit on create → `coming-soon`
- Update must not change slug or track association

### Lab state transitions

Same pattern as Track status transitions. Soft-hide does not delete completions.

---

## Shared enums (new / extended)

### LabStatus (new)

| Value | Meaning |
|-------|---------|
| `active` | Startable / summary allowed (subject to Track also active) |
| `coming-soon` | Visible on path/progress; start/summary blocked |

### VisualizationKitId (new)

| Value | Seed usage |
|-------|------------|
| `database-viz` | Database / SQL Track |
| `redis-viz` | Caching placeholder Track |
| `react-viz` | Frontend Performance placeholder Track |

### MetricCatalogId (extend)

| Value | Notes |
|-------|-------|
| `database-metrics` | Existing |
| `redis-metrics` | Present in Track seeds; add to enum |
| `react-metrics` | Present in Track seeds; add to enum |

---

## Learner projection changes

`LabPathItem` / progress lab items gain:

| Field | Type |
|-------|------|
| status | `LabStatus` |

Ordering unchanged: `sequence_order ASC, slug ASC`.

---

## Relationships

```text
Track 1──* Lab
Lab 1──* UserLabCompletion   (unchanged; no cascade from status)
Lab 1──* Quiz (existing)     (unchanged; Quiz Admin out of scope)
```

Admin writes NEVER touch playground runtime DBs.
