# Quickstart: Track & Lab Admin CRUD

Validate admin Track/Lab catalog writes and learner visibility/gating. Full contract: [contracts/track-lab-admin-api.md](./contracts/track-lab-admin-api.md). Data model: [data-model.md](./data-model.md).

## Prerequisites

- Platform DB migrated (`pnpm migration:run`) — includes Lab `status` backfill to `active`
- API running (`pnpm dev`)
- Admin access token (seeded `admin@playground.local` / `Password123!` or promote per [020 quickstart](../020-admin-authz/quickstart.md))

## 1. Create a Track (defaults to coming-soon)

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/tracks \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "demo-track",
    "name": "Demo Track",
    "description": "Admin CRUD smoke track",
    "displayOrder": 99,
    "runtimeAdapterType": "playground_postgresql",
    "inputSurfaceType": "sql_editor",
    "metricCatalogId": "database-metrics",
    "visualizationKitId": "database-viz"
  }'
```

Expect `201`, `data.status === "coming-soon"`.

Publish:

```bash
curl -s -X PATCH http://localhost:3001/api/v1/admin/tracks/demo-track \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "active" }'
```

## 2. Create a Lab under the Track

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/tracks/demo-track/labs \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "demo-lab",
    "title": "Demo Lab",
    "description": "Smoke lab",
    "sequenceOrder": 1
  }'
```

Expect `201`, `data.status === "coming-soon"`.

## 3. Learner path shows coming-soon Lab

```bash
curl -s http://localhost:3001/api/v1/tracks/demo-track/learning-path
```

Expect `demo-lab` present with `"status": "coming-soon"`.

## 4. Summary blocked until active

```bash
curl -s http://localhost:3001/api/v1/labs/demo-lab/summary \
  -H "Authorization: Bearer $USER_TOKEN"
```

Expect `403 FORBIDDEN` (coming soon).

Activate:

```bash
curl -s -X PATCH http://localhost:3001/api/v1/admin/labs/demo-lab \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "active" }'
```

Re-try summary → success (or lab-content not-found if no summary registry entry — AuthZ/status gate must pass first).

## 5. Non-admin denied

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/tracks \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "slug": "x", "name": "x", "description": "x", "runtimeAdapterType": "playground_postgresql", "inputSurfaceType": "sql_editor", "metricCatalogId": "database-metrics", "visualizationKitId": "database-viz" }'
```

Expect `403 FORBIDDEN`.

## 6. Automated checks

```bash
pnpm test -- admin-tracks admin-labs create-track update-track create-lab
pnpm test:e2e -- track-lab-admin.integration-spec
```

## 7. Existing seeded Labs remain active

After migration, `index-playground` (and other seeded labs) must have `status = active` and remain startable without republish.
