# Research: Metrics Pipeline

## Decision: Embed `metrics[]` inline on experiment/explain success responses

**Rationale**: Lab shell needs metrics immediately after each run without a second round-trip for MVP. History endpoint serves comparison flows separately.

**Alternatives considered**: Metrics-only follow-up poll by run ID (rejected for MVP — adds latency and complicates lab shell); WebSocket push (rejected — overkill for synchronous runs).

## Decision: Platform DB `metric_snapshots` table with JSONB metrics payload

**Rationale**: Snapshots are permanent learner progress artifacts (Platform domain). JSONB stores variable catalog sizes per Track without schema churn per metric key.

**Alternatives considered**: Normalized metric_value rows (rejected — unnecessary complexity for MVP ~8 metrics × 50 snapshots); Redis-only history (rejected — not durable, violates platform/playground separation for progress-like data).

## Decision: Typed in-repo catalog config for `database-metrics`

**Rationale**: Track Registry already references `metricCatalogId`; MVP catalogs are static and versioned with code. Avoids premature admin UI for catalog editing.

**Alternatives considered**: Database-driven catalog tables (deferred — no runtime editing requirement); hardcoding in collectors without catalog abstraction (rejected — blocks future Tracks).

## Decision: Plan tree walk for rows-scanned and index-usage metrics

**Rationale**: Explain Runner already normalizes `ExplainPlanNode` trees. Collectors sum `actualRows` (or `planRows` fallback) across scan nodes and set boolean flags when `indexName` present or `nodeType` indicates Seq Scan.

**Alternatives considered**: Re-query `pg_stat_*` (rejected — sandbox scope and side effects); parse raw plan text (rejected — Explain Runner already structured).

## Decision: Integrate via exported use cases injected into runners

**Rationale**: `RunExperimentSqlUseCase` and `RunExplainUseCase` call `CollectExecutionMetricsUseCase` / `CollectExplainMetricsUseCase` and `PersistMetricSnapshotUseCase` on success — minimal change, clear orchestration order.

**Alternatives considered**: NestJS interceptor on controllers (rejected — loses typed access to parsed plan/result); event bus (rejected — YAGNI for synchronous MVP).

## Decision: Retain history across dataset reset within session

**Rationale**: Index lab pedagogy compares attempts before/after index creation even when learner resets playground; snapshot metadata records dataset identity at capture time.

**Alternatives considered**: Clear history on reset (rejected — loses comparison context learners expect in guided labs).

## Decision: Numeric encoding for scan type observations

**Rationale**: Metric Contract requires numeric `value`. Catalog exposes `seq_scan_used` and `index_scan_used` as 0/1 flags derived from plan node types rather than string scan labels.

**Alternatives considered**: Extend contract with string values (rejected — violates DOMAIN contract); single ordinal `primary_scan_type` (acceptable fallback but less chart-friendly for MVP labs).
