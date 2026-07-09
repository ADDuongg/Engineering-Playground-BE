# Feature Specification: Metrics Pipeline

**Feature Branch**: `008-metrics-pipeline`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Aggregate experiment outputs into backend-owned Metric Contract objects consumed by visualization and labs. Collect Database Track metrics: execution time, rows scanned/returned, index usage, plan summary. Normalize metrics via shared Metric Contract (key, label, unit, value, group). Persist metrics history for compare-before/after flows. Never require frontend to derive engineering metrics."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-08

No clarification questions required. Spec completed with documented assumptions for Database Track MVP scope, session-scoped history retention on dataset reset, numeric encoding for categorical scan observations, and explicit out-of-scope boundaries vs Benchmark Runner and other Tracks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner Sees Normalized Metrics After SQL Execution (Priority: P1)

A learner runs SQL in a Database Track lab. After execution completes, the platform returns a set of backend-normalized metrics — execution time, rows returned, and other catalog-defined measurements — alongside (or embedded within) the execution result. The learner sees human-readable metric labels and units in the lab shell without the frontend computing or inferring engineering values from raw row data or timing fields alone.

**Why this priority**: Metric Contract output is the foundation for every lab visualization and bottom-panel metrics display. Without normalized backend metrics, the frontend would violate constitutional rules by deriving engineering measurements.

**Independent Test**: Run a parameterized `SELECT` against a ready commerce dataset and verify the response includes Metric Contract objects for execution time and rows returned with correct keys, labels, units, values, and groups from the Database Track catalog.

**Acceptance Scenarios**:

1. **Given** a lab's dataset is ready and SQL execution succeeds, **When** results are returned, **Then** the response includes Metric Contract entries for execution time (milliseconds) and rows returned with values matching the underlying execution outcome.
2. **Given** execution returns truncated row data, **When** metrics are produced, **Then** rows-returned metric reflects the actual row count (including truncation awareness) without requiring the frontend to count rows.
3. **Given** a Track declares a metric catalog identifier, **When** metrics are emitted, **Then** only metrics defined in that Track's catalog are included — no ad-hoc keys outside the catalog for MVP Database Track.
4. **Given** execution fails before producing measurable outcomes, **When** the error response is returned, **Then** no partial or misleading success metrics are attached to the failure payload.

---

### User Story 2 - Learner Sees Plan-Derived Metrics After EXPLAIN (Priority: P1)

A learner requests `EXPLAIN` or `EXPLAIN ANALYZE` in a Database Track lab. The platform derives catalog metrics from the structured explain output — rows scanned or estimated, index usage indicators, planning time, execution time, and plan summary signals — and returns them as Metric Contract objects consumable by charts and the metrics panel without parsing raw plan text on the frontend.

**Why this priority**: EXPLAIN and Index labs depend on plan-derived measurements. Explain Runner already produces structured plans; Metrics Pipeline completes the learning loop by exposing planner observations as first-class metrics.

**Independent Test**: Run `EXPLAIN ANALYZE` on a query known to use a sequential scan and one known to use an index scan; verify distinct metric values for scan-related and timing metrics align with plan content.

**Acceptance Scenarios**:

1. **Given** explain completes with a structured plan tree, **When** metrics are produced, **Then** the response includes planning time and execution time metrics (for modes where available) plus rows-scanned or rows-estimated metrics aggregated from plan nodes.
2. **Given** a plan uses an index scan on a named index, **When** metrics are produced, **Then** an index-usage metric indicates index usage without the frontend inspecting plan nodes.
3. **Given** a plan's primary access path is a sequential scan, **When** metrics are produced, **Then** scan-summary metrics reflect sequential scan dominance per catalog rules.
4. **Given** explain fails or is blocked, **When** the error response is returned, **Then** no plan-derived metrics are attached to the failure payload.

---

### User Story 3 - Learner Compares Before/After Experiment Runs (Priority: P1)

A learner runs an experiment, applies a change (e.g., creates an index), and runs again. The platform persists metric snapshots per experiment run so the lab can retrieve prior runs and compare metric values side-by-side — for example, execution time and rows scanned before vs after index creation — without the learner manually recording numbers.

**Why this priority**: Compare-before/after is core pedagogy for Index and EXPLAIN labs. Metrics history enables structured comparison visualizations planned for Lab Shell.

**Independent Test**: Execute two runs in the same lab session with different outcomes; retrieve metric history and verify both snapshots are stored with timestamps and distinguishable values.

**Acceptance Scenarios**:

1. **Given** a successful experiment run completes, **When** metrics are produced, **Then** a metric snapshot is persisted with lab context, run identifier, timestamp, and the full metric set for that run.
2. **Given** a learner has multiple prior runs in the same lab session, **When** metric history is requested, **Then** snapshots are returned in chronological order with run identifiers suitable for comparison UI.
3. **Given** a dataset reset occurs for the session, **When** history retrieval is requested, **Then** policy-defined behavior applies consistently (MVP: history retained per session with reset noted in snapshot metadata, or history cleared — see Assumptions).
4. **Given** metric history exceeds configured retention for a session, **When** new snapshots are stored, **Then** oldest snapshots are pruned according to retention policy without corrupting remaining history.

---

### User Story 4 - Lab Shell Consumes Metrics Without Deriving Engineering Values (Priority: P1)

The lab shell and visualization components receive ready-to-render Metric Contract arrays grouped by catalog `group` fields (e.g., performance, scan, plan). Components map metrics to charts using backend-provided labels and units only. No frontend logic recomputes rows scanned, index usage, or timing from raw execution or explain payloads.

**Why this priority**: Constitutional requirement — frontend must not compute engineering metrics. This story validates architectural compliance end-to-end.

**Independent Test**: Inspect API responses for experiment and explain endpoints; confirm all learner-facing engineering measurements needed by Database Track MVP labs appear in Metric Contract form and raw payloads alone are insufficient for required visualizations.

**Acceptance Scenarios**:

1. **Given** a lab renders the bottom metrics panel, **When** it displays execution time and rows returned, **Then** values are read directly from Metric Contract entries — not computed from `executionTimeMs` or row array length in the frontend.
2. **Given** a lab renders scan or index visualizations, **When** metrics are displayed, **Then** scan and index metrics originate from backend catalog output tied to explain or combined run context.
3. **Given** a metric catalog defines groups, **When** the lab shell organizes the panel, **Then** grouping follows backend `group` values without frontend hardcoding metric semantics per lab.
4. **Given** an unknown metric key appears in a future catalog version, **When** the lab shell receives it, **Then** it can display label, unit, and value generically without code changes for that key.

---

### User Story 5 - Operators Can Trace Metric Provenance (Priority: P2)

Support staff and operators can correlate persisted metric snapshots with lab context, run type (SQL execution vs explain), dataset identity, and correlation identifiers for troubleshooting inaccurate or missing metrics — without accessing full SQL text or row payloads in audit records.

**Why this priority**: Operational visibility supports reliability but is secondary to learner-facing metric correctness.

**Independent Test**: Trigger successful and failed runs; verify metric collection audit events include run type, metric count, and correlation identifier without sensitive SQL content.

**Acceptance Scenarios**:

1. **Given** metrics are collected for a run, **When** audit logging occurs, **Then** the event records run type, lab context, metric count, and correlation identifier.
2. **Given** metric derivation fails partially (e.g., plan parse succeeded but aggregation edge case), **When** the pipeline completes, **Then** available metrics are returned and a diagnostic indicator explains any omitted catalog metrics.

---

### Edge Cases

- What happens when explain is not run and only SQL execution results exist? Execution-only metrics are returned; plan-derived catalog metrics are omitted rather than zero-filled with misleading values.
- What happens when plan nodes disagree on row estimates (multi-node plans)? Aggregation rules sum or take root-level actuals per catalog definition documented in the metric catalog.
- What happens when execution succeeds but returns zero rows? Rows-returned metric is `0`; other metrics still reflect timing and scan behavior where available.
- What happens when the same run produces both execution and explain results in one lab step? Combined metric set merges per catalog rules without duplicate keys; later stage wins or values combine per catalog precedence.
- What happens when metric persistence fails but run succeeds? Learner still receives inline metrics for the current run; history write failure is logged and does not fail the primary experiment response.
- What happens when an unauthenticated or anonymous lab session requests history? History is scoped to session identity per platform auth rules; anonymous sessions use session-scoped identifiers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST transform Experiment Runner outcomes into Metric Contract objects for the Database Track catalog on every successful SQL execution.
- **FR-002**: System MUST transform Explain Runner structured plan outcomes into Metric Contract objects for plan-derived catalog entries on every successful explain request.
- **FR-003**: Every emitted metric MUST conform to the shared contract: `key`, `label`, `unit`, `value` (numeric), and `group`.
- **FR-004**: System MUST source metric definitions (keys, labels, units, groups, derivation rules) from a Track-associated metric catalog — not hardcoded per lab in the frontend.
- **FR-005**: For MVP Database Track, system MUST emit at minimum: execution time, rows returned, rows scanned (or best available estimate from plan), index usage indicator, and plan timing summary metrics when explain data is available.
- **FR-006**: System MUST persist metric snapshots on Platform DB after successful runs, associated with lab session context, run identifier, run type, dataset identity, and timestamp.
- **FR-007**: System MUST expose retrieval of metric history for a lab session to support before/after comparison flows.
- **FR-008**: System MUST NOT attach success metrics to failed experiment or explain responses.
- **FR-009**: System MUST NOT require the frontend to derive engineering metrics from raw execution rows, timing fields, or explain plan trees.
- **FR-010**: System MUST scope metric persistence to Platform DB; playground runtime state MUST NOT be the source of truth for metric history.
- **FR-011**: System MUST enforce retention limits on stored metric snapshots per session to prevent unbounded storage growth.
- **FR-012**: System MUST include metric arrays in experiment and explain API success responses (embedded or linked by reference per API design in planning phase).
- **FR-013**: System MUST support correlation identifiers on metric collection for operational tracing without logging full SQL or row payloads.
- **FR-014**: System MUST handle partial metric derivation gracefully — return available catalog metrics and indicate omitted metrics when source data is insufficient.
- **FR-015**: Categorical plan observations (e.g., primary scan type) MUST be represented as numeric catalog metrics using catalog-defined encoding (e.g., boolean 0/1 flags or ordinal codes with catalog labels) — not as ad-hoc string fields outside the contract.

### Key Entities

- **Metric Contract**: A single measured observation with `key`, `label`, `unit`, numeric `value`, and `group` for UI organization.
- **Metric Catalog**: Track-scoped registry defining available metrics, display metadata, groups, and derivation rules from experiment outputs.
- **Metric Snapshot**: Persisted collection of Metric Contract objects for one experiment run, with run metadata (session, lab, track, run type, dataset, timestamp, correlation id).
- **Metric History**: Ordered set of snapshots for a lab session subject to retention policy.
- **Run Context**: Attribution bundle linking a metric snapshot to track, lab, session, dataset identity, and run type (execution, explain, or combined).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful Database Track SQL execution responses in integration tests include Metric Contract arrays covering execution time and rows returned with values matching execution outcomes.
- **SC-002**: 100% of successful explain responses in integration tests include plan-derived timing metrics and at least one scan or index summary metric aligned with structured plan content.
- **SC-003**: Learners can retrieve two or more metric snapshots from the same lab session and identify before/after differences without manual data entry.
- **SC-004**: Zero frontend engineering metric derivations are required for MVP Database Track bottom-panel metrics — verified by contract test or documentation audit of lab shell consumption path.
- **SC-005**: Metric snapshot persistence completes within 200ms p95 additive latency on top of experiment execution time under nominal test load.
- **SC-006**: Metric history retrieval returns results within 1 second for sessions with up to 50 stored snapshots.

## Assumptions

- MVP scope is **Database Track only**; React and Redis Track catalogs are registered but metric derivation for those tracks is out of scope until their Runtime Adapters exist.
- Experiment Runner and Explain Runner remain the sole sources of raw execution and plan data; Metrics Pipeline does not re-execute SQL.
- Metric catalogs for MVP are configuration-driven (referenced by Track `metricCatalogId` already seeded as `database-metrics`) rather than user-editable at runtime.
- Metric snapshots persist on **Platform DB** with session-scoped history; full user-account history across devices is deferred until Authentication feature links sessions to users.
- On dataset reset within a session, **metric history is retained** with snapshot metadata recording the dataset generation — learners can still compare runs across resets within retention limits. (Alternative: clear on reset — chosen default supports Index lab pedagogy comparing attempts before/after reset-triggered re-prepare.)
- Retention default: **50 snapshots per lab session** unless configured otherwise.
- Benchmark-specific metrics (RPS, P95, P99, throughput) are **out of scope** for this feature; they arrive with Benchmark Runner and extend the catalog later.
- Inline metrics in the current API response are required for MVP; a separate metrics-only polling API is optional and decided in planning.

## Out of Scope

- Benchmark Runner metric collection and realtime benchmark progress metrics
- React Rendering Track and Redis Track metric derivation
- Frontend visualization rendering (Lab Shell consumes metrics but is a separate feature)
- Per-User Rate Limiting and SQL Execution Queue integration (downstream consumers may attach later)
- Custom learner-defined metrics or ad-hoc metric keys outside the Track catalog
- Cross-user metric sharing or leaderboard analytics

## Dependencies

- **Experiment Runner** (Done): Source of SQL execution outcomes (timing, row counts, truncation).
- **Explain Runner** (Done): Source of structured plan trees and explain timing.
- **Track Registry** (Done): Provides `metricCatalogId` per Track.
- **Experiment Isolation** (Done): Session-scoped lab context for snapshot attribution.
