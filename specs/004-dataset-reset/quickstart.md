# Quickstart: Dataset Reset

**Feature**: 004-dataset-reset | **Date**: 2026-07-08

Validate dataset reset after implementation. Prerequisites: Dataset Loader working, Platform DB, Playground PostgreSQL, and Redis running.

## 1. Environment

Same as Dataset Loader quickstart — no additional env vars required. Optional `DATASET_SYNC_TIER_MAX=100k` controls sync/async boundary for reset.

## 2. Run unit tests

```bash
pnpm test -- reset-dataset
pnpm test -- dataset-playground-teardown
```

**Expected**: Reset use case and teardown unit tests pass.

## 3. Run integration tests

Requires playground DB and Redis reachable.

```bash
pnpm test:e2e -- dataset-reset
```

**Expected**:
- Prepare commerce 100K, mutate playground (CREATE TABLE, CREATE INDEX, INSERT), reset, verify baseline restored
- Extra learner table removed after reset
- Platform DB row counts unchanged (tracks table)
- Unknown family returns `404`
- Async 1M reset returns `202` with `resetting`; poll until `ready`

## 4. Manual smoke test (API)

Start the server (`pnpm dev`), then:

### Prepare baseline

```bash
curl -s -X POST http://localhost:3000/datasets/prepare \
  -H 'Content-Type: application/json' \
  -d '{"family":"commerce","tier":"100k","version":"v1"}' | jq
```

### Simulate experiment mutation (via playground SQL client)

```sql
CREATE TABLE learner_scratch (id int);
CREATE INDEX idx_users_email ON users(email);
INSERT INTO users (email, name) VALUES ('test@example.com', 'Test User');
```

### Reset 100K

```bash
curl -s -X POST http://localhost:3000/datasets/reset \
  -H 'Content-Type: application/json' \
  -d '{"family":"commerce","tier":"100k","version":"v1"}' | jq
```

**Expected**: `success: true`, `data.status: "ready"`, `durationMs` < 30000.

### Verify metadata restored

```bash
curl -s 'http://localhost:3000/datasets/metadata?family=commerce&tier=100k&version=v1' | jq
```

**Expected**: Row counts match manifest targets; `learner_scratch` table no longer exists when queried.

### Poll async reset (1M tier)

```bash
curl -s -X POST http://localhost:3000/datasets/reset \
  -H 'Content-Type: application/json' \
  -d '{"family":"commerce","tier":"1m","version":"v1"}' | jq

curl -s 'http://localhost:3000/datasets/reset/status?family=commerce&tier=1m&version=v1' | jq
```

**Expected**: First response `202` with `resetting`; poll until `ready`.

## 5. Verify platform separation

Query platform `tracks` table count before and after reset — must be identical.

## 6. Definition of done checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] 100K reset completes within 30s (spec SC-003)
- [ ] Zero experiment artifacts remain after successful reset (spec SC-004)
- [ ] Audit log events emitted for reset start/complete/fail
- [ ] Shared types exported from `@db-play/types`
- [ ] OpenAPI docs on `/datasets/reset` endpoints

See [dataset-reset-service.md](./contracts/dataset-reset-service.md) for full contract details.
