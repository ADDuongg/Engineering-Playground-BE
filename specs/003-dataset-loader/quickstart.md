# Quickstart: Dataset Loader

**Feature**: 003-dataset-loader | **Date**: 2026-07-08

Validate dataset loading after implementation. Prerequisites: Platform DB, Playground PostgreSQL, and Redis running (see project `.env`).

## 1. Environment

Ensure playground and Redis are configured:

```env
PLAYGROUND_DB_HOST=localhost
PLAYGROUND_DB_PORT=5433
REDIS_HOST=localhost
REDIS_PORT=6379
```

Optional overrides:

```env
DATASET_MANIFEST_PATH=seeds/datasets/manifest.json
DATASET_SYNC_TIER_MAX=100k
DATASET_PREPARATION_TTL_SECONDS=3600
```

## 2. Run unit tests

```bash
pnpm test -- dataset-loader
```

**Expected**: Manifest parsing, use case, and status store unit tests pass.

## 3. Run integration tests

Requires playground DB and Redis reachable.

```bash
pnpm test:e2e -- dataset-loader
```

**Expected**:
- `POST /datasets/prepare` with `commerce` + `100k` completes with `status: ready`
- Playground tables (`users`, `orders`, `products`, `logs`, `payments`) exist
- Row counts within 1% of manifest targets
- Unknown family returns `404`
- `GET /datasets/metadata` returns table catalog when ready

## 4. Manual smoke test (API)

Start the server (`pnpm dev`), then:

### Prepare 100K commerce dataset

```bash
curl -s -X POST http://localhost:3000/datasets/prepare \
  -H 'Content-Type: application/json' \
  -d '{"family":"commerce","tier":"100k","version":"v1"}' | jq
```

**Expected**: `success: true`, `data.status: "ready"`, `durationMs` < 30000.

### Fetch metadata

```bash
curl -s 'http://localhost:3000/datasets/metadata?family=commerce&tier=100k&version=v1' | jq
```

**Expected**: Five tables listed with `actualRowCount` populated and `status: "ready"`.

### Prepare 1M (async path)

```bash
curl -s -X POST http://localhost:3000/datasets/prepare \
  -H 'Content-Type: application/json' \
  -d '{"family":"commerce","tier":"1m","version":"v1"}' | jq
```

**Expected**: HTTP 202, `data.status: "preparing"`. Poll until ready:

```bash
curl -s 'http://localhost:3000/datasets/prepare/status?family=commerce&tier=1m&version=v1' | jq
```

## 5. Verify platform separation

Confirm seed data exists only in playground DB (not platform DB tables). Confirm Redis keys use `dataset:prep:*` prefix with TTL.

## 6. Definition of done checklist

- [ ] Unit tests pass
- [ ] Integration tests pass against playground DB + Redis
- [ ] 100K preparation completes within 30s (spec SC-002)
- [ ] Re-prepare same identity yields equivalent counts (spec SC-004)
- [ ] Shared types exported from `@db-play/types`
- [ ] OpenAPI docs on `/datasets` endpoints
- [ ] No user upload endpoints exist

See [dataset-service.md](./contracts/dataset-service.md) for full contract details.
