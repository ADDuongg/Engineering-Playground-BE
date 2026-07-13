# API Contract: Tracks

**Feature**: 001-track-registry | **Base path**: `/api/v1/tracks` | **Auth**: Public (no bearer required)

All responses use the standard envelope:

```json
{
  "success": true,
  "data": { },
  "meta": { "timestamp": "ISO-8601", "requestId": "uuid" },
  "error": null
}
```

---

## GET /api/v1/tracks

List all Tracks ordered by `displayOrder` ascending, then `name` ascending.

### Response `data`

```typescript
interface TrackListResponse {
  tracks: TrackSummary[];
}

interface TrackSummary {
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'coming-soon';
  displayOrder: number;
}
```

### Example (200)

```json
{
  "success": true,
  "data": {
    "tracks": [
      {
        "slug": "database-sql",
        "name": "Database / SQL",
        "description": "Learn indexes, query plans, pagination, and transactions through hands-on SQL experiments.",
        "status": "active",
        "displayOrder": 1
      },
      {
        "slug": "caching-concurrency",
        "name": "Caching & Concurrency",
        "description": "Explore Redis caching patterns, transactions, isolation, and deadlocks.",
        "status": "coming-soon",
        "displayOrder": 2
      },
      {
        "slug": "frontend-react",
        "name": "Frontend React",
        "description": "Learn how React works under the hood: rendering, reconciliation, keys, closures, and hooks through hands-on component experiments.",
        "status": "active",
        "displayOrder": 3
      }
    ]
  },
  "meta": { "timestamp": "2026-07-08T02:00:00.000Z" },
  "error": null
}
```

### Errors

| Status | Code | When |
|--------|------|------|
| 500 | INTERNAL_ERROR | Unexpected failure |

---

## GET /api/v1/tracks/:slug

Retrieve full Track configuration by slug.

### Path parameters

| Param | Type | Validation |
|-------|------|------------|
| `slug` | string | 3–64 chars, `^[a-z0-9-]+$` |

### Response `data`

```typescript
interface TrackDetail {
  slug: string;
  name: string;
  description: string;
  status: 'active' | 'coming-soon';
  displayOrder: number;
  runtimeAdapterType: RuntimeAdapterType;
  inputSurfaceType: InputSurfaceType;
  metricCatalogId: string;
  visualizationKitId: string;
  isLabStartable: boolean; // derived: status === 'active'
}

type RuntimeAdapterType =
  | 'playground_postgresql'
  | 'playground_redis'
  | 'headless_react_sandbox'
  | 'simulation_engine';

type InputSurfaceType =
  | 'sql_editor'
  | 'command_panel'
  | 'component_sandbox'
  | 'config_form';
```

### Example (200) — active Track

```json
{
  "success": true,
  "data": {
    "slug": "database-sql",
    "name": "Database / SQL",
    "description": "Learn indexes, query plans, pagination, and transactions through hands-on SQL experiments.",
    "status": "active",
    "displayOrder": 1,
    "runtimeAdapterType": "playground_postgresql",
    "inputSurfaceType": "sql_editor",
    "metricCatalogId": "database-metrics",
    "visualizationKitId": "database-viz",
    "isLabStartable": true
  },
  "meta": { "timestamp": "2026-07-08T02:00:00.000Z" },
  "error": null
}
```

### Example (404)

```json
{
  "success": false,
  "data": null,
  "meta": { "timestamp": "2026-07-08T02:00:00.000Z" },
  "error": {
    "code": "NOT_FOUND",
    "message": "Track \"unknown-track\" is not available on this platform."
  }
}
```

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | VALIDATION_ERROR | Invalid slug format |
| 404 | NOT_FOUND | Slug not in catalog |
| 500 | INTERNAL_ERROR | Unexpected failure |

---

## OpenAPI tags

- Tag: `tracks`
- Operations: `listTracks`, `getTrackBySlug`

## Integration test requirements

1. `GET /api/v1/tracks` returns ≥3 seeded Tracks with correct ordering
2. `GET /api/v1/tracks/database-sql` returns full config with `isLabStartable: true`
3. `GET /api/v1/tracks/caching-concurrency` returns `status: coming-soon`, `isLabStartable: false`
4. `GET /api/v1/tracks/does-not-exist` returns 404 with NOT_FOUND
5. Unauthenticated requests succeed (no Authorization header)
