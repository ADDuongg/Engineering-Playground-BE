# Quickstart: Track Registry

**Feature**: 001-track-registry

## Prerequisites

- Node.js ≥ 22, pnpm ≥ 10
- Platform PostgreSQL running (see project `.env`)
- Migrations applied including `InitTracksTable`
- API base URL: `http://localhost:${PORT}/api/v1` (default `PORT` from `.env`, often `3999` or `3001`)

## Setup

```bash
pnpm install
pnpm migration:run
pnpm dev
```

## Validate — List Tracks

```bash
curl -s http://localhost:3000/api/v1/tracks | jq .
```

**Expected**: `success: true`, `data.tracks` array with at least 3 entries; first item slug `database-sql`, status `active`.

## Validate — Track Detail (active)

```bash
curl -s http://localhost:3000/api/v1/tracks/database-sql | jq .
```

**Expected**:
- `runtimeAdapterType`: `playground_postgresql`
- `inputSurfaceType`: `sql_editor`
- `metricCatalogId`: `database-metrics`
- `isLabStartable`: `true`

## Validate — Track Detail (coming-soon)

```bash
curl -s http://localhost:3000/api/v1/tracks/caching-concurrency | jq .
```

**Expected**: `status`: `coming-soon`, `isLabStartable`: `false`

## Validate — Not Found

```bash
curl -s -w "\n%{http_code}\n" http://localhost:3000/api/v1/tracks/unknown-track | jq .
```

**Expected**: HTTP 404, `error.code`: `NOT_FOUND`

## Run Tests

```bash
# Unit tests
pnpm test -- --testPathPattern=tracks

# Integration tests
pnpm test:e2e -- --testPathPattern=tracks
```

**Expected**: All track-related tests pass.

## Platform DB isolation check

After any playground reset (future feature), re-run list endpoint — Track count unchanged.
