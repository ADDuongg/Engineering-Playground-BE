# API Contract: Track & Lab Admin CRUD

**Feature**: track-lab-admin-crud | **Base path**: `/api/v1/admin` | **Auth scheme**: JWT Bearer + `role: admin`

All responses use the standard envelope (`success`, `data`, `meta`, `error`).

Learner routes remain under `/api/v1/tracks` and `/api/v1/progress` / `/api/v1/labs` — no admin mutations there.

---

## Authorization

Same as [Admin AuthZ](../../020-admin-authz/contracts/admin-authz-api.md):

| Caller | Outcome |
|--------|---------|
| No / invalid token | `401 UNAUTHORIZED` |
| `role: user` | `403 FORBIDDEN` |
| `role: admin` | Allowed |

---

## Shared types (`@db-play/types`)

```typescript
type TrackStatus = 'active' | 'coming-soon';
type LabStatus = 'active' | 'coming-soon';

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

type MetricCatalogId =
  | 'database-metrics'
  | 'redis-metrics'
  | 'react-metrics';

type VisualizationKitId =
  | 'database-viz'
  | 'redis-viz'
  | 'react-viz';

interface AdminTrackView {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: TrackStatus;
  displayOrder: number;
  runtimeAdapterType: RuntimeAdapterType;
  inputSurfaceType: InputSurfaceType;
  metricCatalogId: MetricCatalogId;
  visualizationKitId: VisualizationKitId;
  createdAt: string;
  updatedAt: string;
}

interface CreateTrackRequest {
  slug: string;
  name: string;
  description: string;
  status?: TrackStatus; // omit → coming-soon
  displayOrder?: number;
  runtimeAdapterType: RuntimeAdapterType;
  inputSurfaceType: InputSurfaceType;
  metricCatalogId: MetricCatalogId;
  visualizationKitId: VisualizationKitId;
}

interface UpdateTrackRequest {
  name?: string;
  description?: string;
  status?: TrackStatus;
  displayOrder?: number;
  runtimeAdapterType?: RuntimeAdapterType;
  inputSurfaceType?: InputSurfaceType;
  metricCatalogId?: MetricCatalogId;
  visualizationKitId?: VisualizationKitId;
  // slug MUST NOT be accepted
}

interface AdminLabView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  trackSlug: string;
  sequenceOrder: number;
  status: LabStatus;
  createdAt: string;
  updatedAt: string;
}

interface CreateLabRequest {
  slug: string;
  title: string;
  description?: string | null;
  sequenceOrder: number;
  status?: LabStatus; // omit → coming-soon
}

interface UpdateLabRequest {
  title?: string;
  description?: string | null;
  sequenceOrder?: number;
  status?: LabStatus;
  // slug / track MUST NOT be accepted
}
```

Learner `LabPathItem` (additive):

```typescript
interface LabPathItem {
  slug: string;
  title: string;
  description?: string | null;
  sequenceOrder: number;
  status: LabStatus;
}
```

---

## Admin Tracks

### GET /api/v1/admin/tracks

List all Tracks (including coming-soon), ordered by `displayOrder ASC`, then `name ASC`.

**Success** `200`: `{ tracks: AdminTrackView[] }`

### GET /api/v1/admin/tracks/:slug

**Success** `200`: `AdminTrackView`  
**Errors**: `404 NOT_FOUND`

### POST /api/v1/admin/tracks

**Body**: `CreateTrackRequest`  
**Success** `201`: `AdminTrackView`  
**Errors**:

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid fields / unknown config ids / bad slug |
| 409 | `CONFLICT` | Duplicate slug |

### PATCH /api/v1/admin/tracks/:slug

**Body**: `UpdateTrackRequest`  
**Success** `200`: `AdminTrackView`  
**Errors**: `404 NOT_FOUND`, `400 VALIDATION_ERROR`

No `DELETE`.

---

## Admin Labs

### GET /api/v1/admin/tracks/:trackSlug/labs

List Labs for Track, ordered by `sequenceOrder ASC`, then `slug ASC` (duplicate orders allowed).

**Success** `200`: `{ labs: AdminLabView[] }`  
**Errors**: `404 NOT_FOUND` if Track missing

### GET /api/v1/admin/labs/:labSlug

**Success** `200`: `AdminLabView`  
**Errors**: `404 NOT_FOUND`

### POST /api/v1/admin/tracks/:trackSlug/labs

**Body**: `CreateLabRequest`  
**Success** `201`: `AdminLabView`  
**Errors**: `404` (Track), `409` (Lab slug), `400` (validation)

### PATCH /api/v1/admin/labs/:labSlug

**Body**: `UpdateLabRequest`  
**Success** `200`: `AdminLabView`  
**Errors**: `404`, `400`

No `DELETE`. Soft-hide: `PATCH` with `{ "status": "coming-soon" }`.

---

## Learner behavior changes (non-admin)

| Surface | Change |
|---------|--------|
| `GET /tracks/:slug/learning-path` | Each lab includes `status`; coming-soon labs still listed |
| `GET /progress/tracks/:trackSlug` | Each lab includes `status`; coming-soon still listed |
| `GET /labs/:labSlug/summary` | `403 FORBIDDEN` when lab status is not `active` (clear coming-soon message) |
| `POST /progress/labs/:labSlug/complete` | `403 FORBIDDEN` when lab status is not `active` |

Track-level coming-soon rules remain as today (in addition to Lab status).

---

## Error examples

**Duplicate slug** `409`:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Track slug already exists",
    "details": { "field": "slug", "slug": "database-sql" }
  }
}
```

**Unknown config** `400`:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Unknown visualization kit id",
    "details": {
      "field": "visualizationKitId",
      "value": "unknown-viz",
      "allowed": ["database-viz", "redis-viz", "react-viz"]
    }
  }
}
```

**Coming-soon lab summary** `403`:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "Lab is coming soon and is not available to start yet"
  }
}
```
