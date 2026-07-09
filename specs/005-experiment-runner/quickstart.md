# Quickstart: Experiment Runner

**Feature**: 005-experiment-runner | **Date**: 2026-07-08

Validate experiment SQL execution after implementation. Prerequisites: Dataset Loader, SQL Sandbox, Platform DB, Playground PostgreSQL, and Redis running.

## 1. Environment

Same as Dataset Loader quickstart — sandbox timeout/row caps via existing `SANDBOX_*` env vars.

## 2. Run unit tests

```bash
pnpm test -- run-experiment-sql
```

**Expected**: Readiness gate and error mapping unit tests pass.

## 3. Run integration tests

Requires playground DB and Redis reachable.

```bash
pnpm test:e2e -- experiment-runner
```

**Expected**:
- Prepare commerce 100K → run SELECT → structured results with rows and timing
- Run without prepare → `DATASET_NOT_READY` with `not_started` status
- Run during reset → blocked with `resetting` status
- Sandbox violation (DROP DATABASE) → `SANDBOX_ERROR` before DB contact
- Platform DB unchanged after runs

## 4. Manual smoke test (API)

Start the server (`pnpm dev`), then:

### Prepare dataset

```bash
curl -s -X POST http://localhost:3000/datasets/prepare \
  -H 'Content-Type: application/json' \
  -d '{"family":"commerce","tier":"100k","version":"v1"}' | jq
```

### Run experiment SQL

```bash
curl -s -X POST http://localhost:3000/experiments/sql/run \
  -H 'Content-Type: application/json' \
  -d '{
    "sql": "SELECT count(*) AS cnt FROM users WHERE id = $1",
    "parameters": [1],
    "dataset": {"family":"commerce","tier":"100k","version":"v1"},
    "context": {"trackSlug":"database-sql","labSlug":"index-playground"}
  }' | jq
```

**Expected**: `success: true`, `data.rows` present, `data.executionTimeMs` > 0, `data.statementKind: "select"`.

### Run without prepare (fresh Redis key)

Use a unique tier or flush Redis key, then:

```bash
curl -s -X POST http://localhost:3000/experiments/sql/run \
  -H 'Content-Type: application/json' \
  -d '{
    "sql": "SELECT 1",
    "parameters": [],
    "dataset": {"family":"commerce","tier":"100k","version":"v1"}
  }' | jq
```

**Expected**: `success: false`, error with `DATASET_NOT_READY` reason.

### Sandbox violation

```bash
curl -s -X POST http://localhost:3000/experiments/sql/run \
  -H 'Content-Type: application/json' \
  -d '{
    "sql": "DROP DATABASE postgres",
    "parameters": [],
    "dataset": {"family":"commerce","tier":"100k","version":"v1"}
  }' | jq
```

**Expected**: `SANDBOX_ERROR` — blocked before execution.

## 5. Definition of done checklist

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] 100% not-ready attempts blocked before SQL (spec SC-002)
- [ ] Platform DB unchanged (spec SC-005)
- [ ] Audit log events for start/complete/fail
- [ ] Shared types exported from `@db-play/types`
- [ ] OpenAPI docs on `/experiments/sql/run`

See [experiment-runner-service.md](./contracts/experiment-runner-service.md) for full contract details.
