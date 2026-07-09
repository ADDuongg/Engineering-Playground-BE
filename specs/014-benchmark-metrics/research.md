# Research: Benchmark Metrics

**Feature**: 014-benchmark-metrics | **Date**: 2026-07-09

## R1 — Where does collection live?

**Decision**: Extend `MetricsPipelineModule` with `CollectBenchmarkMetricsUseCase` + `BenchmarkFinishedListener`; do not create a separate `BenchmarkMetricsModule`.

**Rationale**: Spec reuses Metric Contract, catalog, Platform DB snapshots, and retention. Metrics Pipeline already owns those. A second module would duplicate persistence and history patterns.

**Alternatives considered**:
- New `BenchmarkMetricsModule` — clearer name, but duplicates repository/retention and splits catalog ownership.
- Collect inside `BenchmarkWorkerProcessor` — couples worker to Platform DB metrics; harder to test and violates “metrics pipeline owns derivation.”

---

## R2 — Trigger for automatic collection

**Decision**: Subscribe to existing `BENCHMARK_FINISHED_EVENT` (`benchmark.finished`). On `status === completed` with `k6Summary`, run collection + persist; on `failed` or missing summary, skip success metrics and emit observability for collection skip/failure.

**Rationale**: Runner already emits this event after `markCompleted`/`markFailed`. Listener keeps completion path non-blocking for the worker’s critical path (fire-and-forget async handler with error logging). Clarification: auto-collect on success only.

**Alternatives considered**:
- Inline call from worker processor — simpler wiring, but tight coupling and harder to disable/test in isolation.
- Polling completed jobs — wasteful and delayed vs event.

---

## R3 — k6 summary → catalog mapping

**Decision**: Parse k6 `--summary-export` JSON via a dedicated `K6SummaryParser`:

| Catalog key | Source (k6 summary) | Notes |
| ----------- | ------------------- | ----- |
| `latency_avg_ms` | `metrics.http_req_duration.values.avg` | Mean latency |
| `latency_p95_ms` | `metrics.http_req_duration.values['p(95)']` | |
| `latency_p99_ms` | `metrics.http_req_duration.values['p(99)']` | |
| `achieved_rps` | `metrics.http_reqs.values.rate` | All attempts / sec |
| `throughput_rps` | `http_reqs.rate * (1 - http_req_failed.rate)` | Successful / sec |
| `error_rate_pct` | `metrics.http_req_failed.values.rate * 100` | 0–100 scale |

If required fields are missing/NaN → collection fails (metrics unavailable); job stays completed (FR-018).

**Rationale**: Matches clarification semantics (distinct RPS vs throughput; error % 0–100). k6 failed rate is 0–1.

**Alternatives considered**:
- Expose only `http_reqs.rate` as both RPS and throughput — rejected by clarification.
- Store raw k6 metrics for frontend — violates constitution.

---

## R4 — Status embed vs dedicated APIs

**Decision**: Dual path (clarification B):
1. After persist, write `metrics` (+ `runId`, `metricsStatus: 'ready'`) into job `payloadSummary` so `GET /benchmarks/:jobId` embeds them.
2. Dedicated `GET /benchmarks/:jobId/metrics` reads Platform DB snapshot by `jobId` (source of truth for charts/history).
3. Dedicated `GET /benchmarks/metrics/history?sessionId=` (optional `labSlug`, `limit`) returns `runType === 'benchmark'` snapshots.

**Rationale**: Status poll matches SQL-execution embed UX; Platform DB remains durable history independent of job TTL.

**Alternatives considered**:
- Status-only — weak history if jobs expire.
- History-only — extra round trip for every completed poll.

---

## R5 — Snapshot schema extension

**Decision**: Add nullable columns to `metric_snapshots`:
- `job_id` (varchar, unique where not null) — correlate to benchmark job
- `profile` (jsonb, nullable) — `{ rps, durationSeconds }`
- Extend `run_type` values with `benchmark`
- Dataset columns: for benchmarks, copy from job target dataset in event/payload (required by existing NOT NULL columns); if absent, use placeholders from job payloadSummary.target.dataset

**Rationale**: Existing entity requires dataset fields; benchmarks already carry dataset on enqueue payload. Unique `job_id` prevents duplicate snapshots on event retry.

**Alternatives considered**:
- Separate `benchmark_metric_snapshots` table — unnecessary duplication.
- Encode jobId only in `request_id` — weak querying and no profile for history UI.

---

## R6 — Collection failure / no re-collect

**Decision**: On parse/persist failure: log `benchmark_metrics_collected` phase `failed`; set job `payloadSummary.metricsStatus = 'unavailable'`; do not fail the benchmark job; no re-collect API (clarification).

**Rationale**: Spec FR-018 / out of scope. Operators use logs.

---

## R7 — Catalog source enum

**Decision**: Extend `MetricSource` with `'benchmark'` and register the six keys in `DATABASE_METRICS_CATALOG` with `source: 'benchmark'`. Execution/explain collectors ignore them; benchmark collector emits only `source === 'benchmark'` (or explicit key list).

**Rationale**: Single Track catalog (`database-metrics`) keeps Lab Shell generic.

---

## R8 — Ownership & auth

**Decision**: Reuse Benchmark Runner ownership rules (userId or sessionId) for metrics-by-job and history. History scoped to `sessionId` (+ optional labSlug); deny cross-user via same checks as status when job-scoped.

**Rationale**: Consistent with `GetBenchmarkStatusUseCase`.

---

## Resolved Technical Context

All planning unknowns resolved; no remaining NEEDS CLARIFICATION for implementation design.
