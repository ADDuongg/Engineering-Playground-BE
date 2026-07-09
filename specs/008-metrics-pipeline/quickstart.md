# Quickstart: Metrics Pipeline

## Prerequisites

- Playground PostgreSQL, Platform DB, Redis configured
- Commerce dataset seeds available
- Experiment Runner and Explain Runner operational (features 005, 007)

## Validate

Run platform migration before integration tests:

```bash
pnpm migration:run
pnpm test -- collect-execution-metrics.usecase.spec
pnpm test -- collect-explain-metrics.usecase.spec
pnpm test -- persist-metric-snapshot.usecase.spec
pnpm test:e2e -- metrics-pipeline.integration-spec
```

## Manual flow — execution metrics

1. `POST /datasets/prepare` — commerce / 100k / v1
2. `POST /experiments/sql/run`:

```json
{
  "sql": "SELECT count(*) FROM users",
  "parameters": [],
  "dataset": { "family": "commerce", "tier": "100k", "version": "v1" },
  "context": { "trackSlug": "database", "labSlug": "index-playground" },
  "sessionId": "test-session-1"
}
```

3. Expect `data.metrics` array with `execution_time_ms` and `rows_returned` entries plus `data.runId`.

## Manual flow — explain metrics

1. `POST /experiments/sql/explain` with same context and `"explainMode": "explain_analyze"`.
2. Expect `data.metrics` including `rows_scanned`, `planning_time_ms`, and scan flags (`seq_scan_used` or `index_scan_used`).

## Manual flow — history comparison

1. Run SQL twice (e.g. before and after `CREATE INDEX` in sandbox).
2. `GET /experiments/metrics/history?sessionId=test-session-1&labSlug=index-playground`
3. Expect two snapshots ordered by time with differing `execution_time_ms` / scan metrics.

## Expected metric keys (Database Track MVP)

See [data-model.md](./data-model.md) catalog table. All values numeric; labels/units suitable for direct UI display.
