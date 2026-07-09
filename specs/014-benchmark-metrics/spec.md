# Feature Specification: Benchmark Metrics

**Feature Branch**: `014-benchmark-metrics`

**Created**: 2026-07-09

**Status**: Spec Ready

**Input**: User description: "Collect and expose throughput, latency, and error metrics from completed benchmarks. Deliver latency, P95, P99, RPS, throughput, and error-rate aggregates; store benchmark results for history and comparison; provide a backend-owned metrics API for charts; keep metric units consistent across all benchmark labs (PRD §13, ROADMAP §Benchmark)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-09

- Q: When are benchmark metrics collected? → A: Auto-collect on successful benchmark completion (persist snapshot immediately)
- Q: How do learners get metrics for a completed run? → A: Dedicated metrics + history endpoints, and embed Metric Contract array on completed benchmark status
- Q: How is error rate expressed in the Metric Contract? → A: Percentage 0–100 (e.g. 5.0 means 5%)
- Q: What does throughput mean vs achieved RPS? → A: Achieved RPS = all requests/sec; throughput = successful requests/sec (two distinct metrics)
- Q: If automatic collection fails after a successful load test, can metrics be repaired? → A: No re-collect in MVP — metrics unavailable; job stays completed; ops via logs only

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner Sees Chart-Ready Metrics After a Completed Benchmark (Priority: P1)

A learner finishes a load benchmark in a Database Track lab. When they check the completed job status, the platform embeds backend-normalized Metric Contract values for latency, P95, P99, achieved RPS, throughput, and error rate — with human-readable labels and consistent units — so the lab can render charts from the same poll path without parsing raw load-test output. The same metrics remain available via dedicated metrics and history endpoints for comparison flows.

**Why this priority**: Benchmark labs teach throughput and latency under load. Without normalized metrics, the frontend would violate the constitution by deriving engineering values from raw executor summaries.

**Independent Test**: Complete a successful benchmark job and verify the learner-facing result includes Metric Contract entries for latency, P95, P99, RPS, throughput, and error rate with catalog-defined keys, labels, units, and groups.

**Acceptance Scenarios**:

1. **Given** a benchmark job reaches completed status with usable load-test output, **When** collection runs automatically on completion, **Then** Metric Contract entries for average (or mean) latency, P95 latency, P99 latency, achieved RPS, throughput, and error rate are persisted and embedded on the completed benchmark status response.
2. **Given** those metrics are returned on status or via the metrics endpoint, **When** the lab shell renders charts or a metrics panel, **Then** it uses backend-provided `key`, `label`, `unit`, `value`, and `group` only — it does not compute percentiles or rates from raw executor output.
3. **Given** a completed benchmark, **When** metrics are emitted, **Then** units are consistent with the Track metric catalog (latency percentiles in milliseconds, rates in requests per second, error rate as a percentage on a 0–100 scale).
4. **Given** a benchmark fails before producing usable load-test output, **When** the learner retrieves status, **Then** no success-looking benchmark metrics are attached; failure remains categorized as today.

---

### User Story 2 - Learner Compares Benchmark Runs Over Time (Priority: P1)

A learner runs a benchmark, optimizes their query (e.g., adds an index), and runs again with the same load profile. The platform persists each completed benchmark’s metric snapshot so the learner can retrieve prior results and compare latency and throughput before vs after — without manually recording numbers.

**Why this priority**: Before/after comparison is the core pedagogy of Benchmark Lab and Index/EXPLAIN labs under load. History makes comparison charts possible.

**Independent Test**: Complete two successful benchmarks in the same lab session with different outcomes; retrieve history and verify both snapshots are stored with timestamps, profile context, and distinguishable metric values.

**Acceptance Scenarios**:

1. **Given** a benchmark completes successfully, **When** automatic collection runs on completion, **Then** a metric snapshot is stored immediately with session/lab context, benchmark job identifier, load profile (RPS tier and duration), timestamp, and the full benchmark metric set — without waiting for a learner metrics request.
2. **Given** a learner has multiple completed benchmarks in the same lab session, **When** they request benchmark metric history, **Then** snapshots are returned in chronological order suitable for comparison UI.
3. **Given** history exceeds the configured retention limit for the session, **When** a new snapshot is stored, **Then** oldest snapshots are pruned without corrupting remaining history.
4. **Given** a learner requests history for another user’s session or job, **When** authorization is checked, **Then** access is denied.

---

### User Story 3 - Labs Consume a Stable Benchmark Metrics API (Priority: P1)

Lab and chart components need a stable, backend-owned way to fetch metrics for a specific completed benchmark and for session history, plus an embedded Metric Contract array on completed benchmark status for the primary poll path. Dedicated endpoints return Metric Contract arrays (and enough context to label the run) so visualization and comparison do not depend on ephemeral raw executor summaries.

**Why this priority**: Benchmark Lab needs both a fast status poll for the just-finished run and a durable history API for before/after charts. Backend ownership keeps units and keys consistent across labs.

**Independent Test**: After a completed benchmark, verify completed status embeds the Metric Contract array; also call metrics-by-job and session history and confirm values match the embedded set for that run.

**Acceptance Scenarios**:

1. **Given** a completed benchmark with persisted metrics, **When** the learner polls benchmark status, **Then** the completed status includes the Metric Contract array (and profile/timestamps) without requiring raw executor summary fields for charts.
2. **Given** a completed benchmark with persisted metrics, **When** the learner requests metrics for that job via the dedicated metrics endpoint, **Then** they receive the same Metric Contract array and run context as on status.
3. **Given** a session with multiple completed benchmarks, **When** the learner requests history via the dedicated history endpoint, **Then** each entry includes enough identity (job id, timestamp, profile) to plot and compare runs.
4. **Given** a job is still queued or running, **When** metrics are requested for that job (status or metrics endpoint), **Then** the platform indicates metrics are not yet available rather than returning zeros or inventing partial values.
5. **Given** a job completed but automatic metric collection failed, **When** status or metrics are requested, **Then** the learner receives a clear unavailable/error indication for metrics; the job lifecycle status remains independently queryable.

---

### User Story 4 - Operators Can Trace Benchmark Metric Provenance (Priority: P2)

Support staff can correlate a persisted benchmark metric snapshot with the originating benchmark job, session, load profile, and correlation identifiers for troubleshooting missing or surprising chart values — without exposing full SQL text or raw row payloads in audit records.

**Why this priority**: Operational visibility supports reliability but is secondary to learner-facing correctness.

**Independent Test**: Complete a successful benchmark and a failed collection path; verify audit/observability events include job id, metric count (or failure category), and correlation context without sensitive SQL content.

**Acceptance Scenarios**:

1. **Given** benchmark metrics are collected successfully, **When** observability events are emitted, **Then** they record job id, session id, metric count, and profile summary.
2. **Given** metric derivation fails after a successful load test, **When** the failure is recorded, **Then** operators can distinguish “benchmark succeeded but metrics unavailable” from “benchmark execution failed.”

---

### Edge Cases

- What happens when a benchmark completes with an empty or malformed load-test summary? Metrics collection fails gracefully; job remains completed if execution succeeded, and metrics endpoints/status report unavailable with a learner-appropriate message. MVP provides no learner-facing or admin re-collect; operators diagnose via observability logs only.
- What happens when achieved RPS is far below the requested tier (target saturated)? Metrics still report measured achieved RPS, throughput (successful RPS), latency percentiles, and error rate from actual results — not the requested tier alone.
- What happens when error rate is 100% (all requests failed)? Metrics are still emitted with high error rate and available latency/throughput observations; charts must not treat this as a “successful learning run” solely because the job completed.
- What happens when the learner requests metrics for a non-benchmark job id? The request is rejected as not found or wrong job type.
- What happens on dataset reset within a session? Benchmark metric history is retained with snapshot metadata (aligned with Metrics Pipeline session history policy) so learners can still compare runs across resets within retention limits.
- What happens when two benchmarks complete nearly simultaneously for different sessions? Snapshots remain isolated per session; no cross-session leakage.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST automatically derive and persist benchmark Metric Contract objects when a Benchmark Runner job completes successfully with usable load-test output — without waiting for a learner metrics request and without re-running the load test.
- **FR-002**: System MUST emit at minimum the following catalog metrics for a successful collection: mean/average latency, P95 latency, P99 latency, achieved RPS (all requests per second), throughput (successful requests per second), and error rate — as two distinct rate metrics plus the other required fields.
- **FR-003**: Every emitted metric MUST conform to the shared Metric Contract: `key`, `label`, `unit`, numeric `value`, and `group`.
- **FR-004**: System MUST source benchmark metric definitions (keys, labels, units, groups, derivation rules) from the Track-associated metric catalog — not hardcoded per lab in the frontend.
- **FR-005**: System MUST use consistent units across all benchmark labs for the same metric keys (latency in milliseconds; achieved RPS and throughput both in requests-per-second with distinct semantics — all attempts vs successful only; error rate as a percentage on a 0–100 scale where 5.0 means 5%).
- **FR-006**: System MUST persist benchmark metric snapshots on Platform DB as part of automatic post-completion collection, associated with lab/session context, benchmark job identifier, load profile (RPS tier and duration), timestamp, and run type distinguishing benchmarks from SQL/EXPLAIN runs.
- **FR-007**: System MUST expose a dedicated retrieval path for metrics of a single completed benchmark job owned by the requesting learner/session.
- **FR-008**: System MUST expose a dedicated retrieval path for benchmark metric history for a lab session to support before/after comparison.
- **FR-009**: System MUST embed the collected Metric Contract array on the completed benchmark status response so labs can render charts from the primary status poll without an extra round trip.
- **FR-010**: System MUST NOT require the frontend to derive latency percentiles, RPS, throughput, or error rate from raw load-test summaries.
- **FR-011**: System MUST NOT attach success benchmark metrics to failed benchmark jobs that never produced usable load-test output.
- **FR-012**: System MUST enforce retention limits on stored benchmark metric snapshots per session to prevent unbounded storage growth.
- **FR-013**: System MUST deny access to another user’s benchmark metrics and history.
- **FR-014**: System MUST indicate clearly when metrics are not yet available (job not completed) or collection failed after completion — on both status and dedicated metrics paths.
- **FR-015**: System MUST emit observability events for successful and failed benchmark metric collection suitable for operations monitoring, without logging full SQL or row payloads.
- **FR-016**: System MUST keep learner-facing metric surfaces (embedded status metrics and dedicated metrics/history endpoints) independent of ephemeral raw executor payload shapes; raw summaries MAY remain on the job for internal use but MUST NOT be required by labs to render charts.
- **FR-017**: Embedded status metrics and dedicated metrics-by-job results for the same completed run MUST present the same Metric Contract values.
- **FR-018**: When automatic metric collection fails after a successful load test, the system MUST leave the benchmark job in completed status, expose metrics as unavailable, and MUST NOT provide a learner-facing or admin re-collect/repair action in MVP.

### Key Entities

- **Benchmark Metric Set**: The catalog Metric Contract array for one completed benchmark (latency, percentiles, RPS, throughput, error rate).
- **Benchmark Metric Snapshot**: Persisted collection of Metric Contract objects for one benchmark job, with job id, session/lab context, load profile, timestamp, and run-type attribution.
- **Benchmark Metric History**: Ordered set of benchmark snapshots for a lab session subject to retention policy.
- **Load Profile Context**: The RPS tier and duration recorded with the snapshot so comparisons remain meaningful across runs.
- **Metric Catalog (benchmark entries)**: Track-scoped definitions for benchmark metric keys, labels, units, groups, and derivation rules from load-test outcomes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful completed benchmarks in integration tests expose Metric Contract arrays covering latency, P95, P99, RPS, throughput, and error rate on both completed status and the dedicated metrics path, with values consistent with the underlying load-test summary.
- **SC-002**: Learners can retrieve two or more benchmark metric snapshots from the same lab session and identify before/after differences without manual data entry.
- **SC-003**: Zero frontend engineering metric derivations are required for Benchmark Lab charts — verified by contract audit that chart inputs are Metric Contract fields only.
- **SC-004**: Benchmark metric retrieval for a single completed job returns within 1 second under nominal test load.
- **SC-005**: Benchmark metric history retrieval returns within 1 second for sessions with up to 50 stored benchmark snapshots.
- **SC-006**: 100% of unauthorized cross-user metric/history requests are denied in acceptance tests.

## Assumptions

- **Benchmark Runner** is Done and already attaches raw load-test summary to completed jobs and emits a completion signal; this feature consumes that signal/summary for **automatic** collection on successful completion rather than replacing execution or deferring collection to first read.
- **Metrics Pipeline** patterns (Metric Contract, Platform DB snapshots, session-scoped retention) are reused and extended for benchmark run types; SQL/EXPLAIN metric behavior remains unchanged.
- MVP scope is **Database Track** benchmark labs only; other Tracks reuse the same contract later.
- Default retention aligns with Metrics Pipeline: **50 snapshots per lab session** unless configured otherwise.
- On dataset reset, **benchmark metric history is retained** (same pedagogy default as Metrics Pipeline).
- **Achieved RPS** and **throughput** are distinct catalog metrics: achieved RPS is measured overall request rate (all attempts per second); throughput is successful requests per second. Exact field mapping from the load-test summary is a design concern in planning.
- Error rate is a single Metric Contract value expressed as a **percentage 0–100** (not a 0–1 ratio); labs MUST NOT convert raw failed/total counts into a rate.
- Mean/average latency is included alongside P95/P99 so labs can show both typical and tail latency.
- **Realtime Progress** (live partial metrics during a run) remains a separate feature; this feature covers completed-run metrics and history only.
- Authentication and session ownership rules match existing Benchmark Runner status access (authenticated user or valid session for anonymous lab access where allowed).
- Learner access model is dual-path: **embed on completed status** for the just-finished run, plus **dedicated metrics and history endpoints** as the stable chart/comparison contract.
- Collection-failure repair (re-derive from stored raw summary) is **out of scope for MVP**; failed collection is terminal for that job’s metrics surface.

## Dependencies

- **Benchmark Runner** (Done): Produces completed jobs with load-test summary and lifecycle status.
- **Metrics Pipeline** (Done): Shared Metric Contract, catalog resolution, and snapshot persistence patterns.
- **Authentication** (Done): Identity for ownership checks on metrics APIs.
- **Experiment Isolation** (Done): Session context for snapshot attribution.

## Out of Scope

- Live progress streaming or partial metrics while a benchmark is still running (Realtime Progress feature).
- Replacing or re-implementing Benchmark Runner scheduling, k6 execution, or job lifecycle.
- Frontend chart rendering and Lab Shell layout (consumers of this API; separate Learning Platform / Lab features).
- Custom learner-defined metrics or arbitrary percentile lists beyond the catalog (P95/P99 required; additional percentiles optional later).
- Cross-user leaderboards or global benchmark analytics.
- Benchmarking targets outside the learner’s playground experiment session.
- Learner-facing or admin re-collect/repair of metrics after automatic collection failure (MVP).
