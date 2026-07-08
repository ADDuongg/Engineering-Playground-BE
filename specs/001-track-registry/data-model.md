# Data Model: Track Registry

**Feature**: 001-track-registry | **Date**: 2026-07-08

## Entity: Track

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Internal identifier |
| `slug` | VARCHAR(64) | UNIQUE, NOT NULL | Stable URL/API key (e.g. `database-sql`) |
| `name` | VARCHAR(120) | NOT NULL | Display name |
| `description` | TEXT | NOT NULL | Learning domain summary |
| `status` | ENUM | NOT NULL | `active` \| `coming-soon` |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 | Stable list ordering |
| `runtime_adapter_type` | ENUM | NOT NULL | Adapter identifier |
| `input_surface_type` | ENUM | NOT NULL | Lab Shell input plugin type |
| `metric_catalog_id` | VARCHAR(64) | NOT NULL | Reference to metric catalog |
| `visualization_kit_id` | VARCHAR(64) | NOT NULL | Reference to visualization kit |
| `created_at` | TIMESTAMPTZ | NOT NULL | Audit |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Audit |

### Indexes

- `UQ_tracks_slug` — unique slug
- `IDX_tracks_display_order` — list ordering

### Enums

**track_status**: `active`, `coming-soon`

**runtime_adapter_type**: `playground_postgresql`, `playground_redis`, `headless_react_sandbox`, `simulation_engine`

**input_surface_type**: `sql_editor`, `command_panel`, `component_sandbox`, `config_form`

## Seed Data (MVP)

| slug | name | status | display_order | runtime_adapter | input_surface | metric_catalog_id | visualization_kit_id |
|------|------|--------|---------------|-----------------|---------------|-------------------|----------------------|
| `database-sql` | Database / SQL | active | 1 | playground_postgresql | sql_editor | database-metrics | database-viz |
| `caching-concurrency` | Caching & Concurrency | coming-soon | 2 | playground_redis | command_panel | redis-metrics | redis-viz |
| `frontend-performance` | Frontend Performance | coming-soon | 3 | headless_react_sandbox | component_sandbox | react-metrics | react-viz |

## Relationships

- **Track → Labs** (future): One Track has many Labs — not implemented in this feature
- **Track → Runtime Adapter** (logical): Resolved via `runtime_adapter_type` enum, not FK

## Validation Rules

- `slug`: lowercase alphanumeric and hyphens only; 3–64 chars
- `name`: 1–120 chars
- `description`: 1–2000 chars
- `display_order`: non-negative integer
- Catalog/kit IDs: lowercase alphanumeric and hyphens; must match known constants for seeded Tracks

## State Transitions

MVP: status set at seed time only. Future admin feature may transition `coming-soon` → `active`.

## Platform vs Runtime

Track records live exclusively on **Platform DB**. Playground reset operations MUST NOT touch `tracks` table.
