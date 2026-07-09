# Quickstart: Benchmark Metrics

**Feature**: 014-benchmark-metrics  
**Contracts**: [benchmark-metrics-service.md](./contracts/benchmark-metrics-service.md)  
**Data model**: [data-model.md](./data-model.md)

## Prerequisites

- Platform DB migrated (including metric_snapshots extension for `job_id` / `profile`)
- API + Redis + playground DB running
- `pnpm dev:benchmark-worker` running
- Authenticated learner (or valid experiment `sessionId` for anonymous lab access)
- Experiment session **READY** with a valid SQL target (same as Benchmark Runner)

## Validation scenarios

### 1. Auto-collect + status embed

1. Enqueue a short benchmark (`POST /api/v1/benchmarks`, e.g. 100 RPS / 10s).
2. Poll `GET /api/v1/benchmarks/:jobId` until `status === completed`.
3. Expect `metricsStatus === 'ready'` and `metrics[]` containing:
   - `latency_avg_ms`, `latency_p95_ms`, `latency_p99_ms`
   - `achieved_rps`, `throughput_rps`, `error_rate_pct` (0–100)
4. Confirm response does **not** require parsing raw load-test summary for charts.

### 2. Dedicated metrics-by-job

1. After scenario 1, call `GET /api/v1/benchmarks/:jobId/metrics`.
2. Expect same Metric Contract values as embedded status (`FR-017`).

### 3. History / before-after

1. Complete two benchmarks in the same `sessionId` (optionally change SQL between runs).
2. Call `GET /api/v1/benchmarks/metrics/history?sessionId=...`.
3. Expect ≥ 2 snapshots with `jobId`, `profile`, `metrics`, chronological order.

### 4. Unauthorized access

1. Request another user’s `jobId` metrics/status.
2. Expect `403 FORBIDDEN`.

### 5. Collection unavailable (controlled)

1. Simulate malformed summary in unit/integration fixture (or force parser failure).
2. Job remains `completed`; status/metrics show `metricsStatus: 'unavailable'`; no re-collect endpoint.

## Suggested commands

```bash
pnpm migration:run
pnpm test -- --testPathPattern='collect-benchmark-metrics|k6-summary.parser|get-benchmark-metrics|get-benchmark-metric-history|benchmark-metrics-parity'
pnpm exec jest --config ./test/jest-e2e.json --testPathPattern='benchmark-metrics' --no-coverage
```

## Success checklist

- [x] SC-001: Completed benchmarks expose full catalog set on status + metrics path
- [x] SC-002: History returns ≥ 2 comparable snapshots
- [x] SC-003: Chart inputs are Metric Contract fields only
- [x] SC-004 / SC-005: Retrieval within 1s under nominal load
- [x] SC-006: Cross-user access denied
