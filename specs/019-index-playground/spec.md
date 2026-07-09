# Feature Specification: Index Playground

**Feature Branch**: `019-index-playground`

**Created**: 2026-07-09

**Status**: Done

**Input**: User description: "Teach B-Tree index impact through before/after experiments (ROADMAP §Index Lab, PRD §Lab 1). Deliverables: run queries with and without indexes; create/drop index actions within sandbox; explain analyze and benchmark integration; metrics payload (scan type and row counts) for FE charts; lab quiz definitions and summary API. SQL Track first; Redis and frontend deferred."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-09

- Q: How is lab summary delivered? → A: Dedicated authenticated lab-summary read API (slug-scoped); Index Playground first, reusable for later labs (option A).
- Q: How are create/drop index actions performed? → A: SQL-only via existing Experiment Runner + SQL Sandbox; lab summary documents recommended DDL strings; no dedicated index-action endpoints (option B).
- Q: Where do scan type & rows scanned come from for before/after comparison? → A: Explain / Explain Analyze is the primary source; plain SQL runs remain execution-focused (time, rows returned) (option A).
- Q: Benchmark in Index Playground MVP? → A: Optional/P2 — summary may mention benchmark; reuse existing Benchmark Runner only; no new benchmark APIs; P1 Done without benchmark acceptance tests (option B).
- Q: Canonical guided query / index target? → A: `SELECT … FROM users WHERE email = $1` with recommended B-Tree index on `users(email)` (option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lab Summary and Guided Learning Content (Priority: P1)

An authenticated learner opens the Index Playground lab in the Database Track. The platform returns a lab summary: learning goal, short theory, recommended experiment steps (run without index → observe scan → create index → run again → compare), and pointers to quiz/progress—so the client can present the lab without hard-coding curriculum copy.

**Why this priority**: Without lab summary content, the Index Lab cannot teach “why” before “how”; this is the entry point for Lab 1 MVP.

**Independent Test**: Request lab summary for `index-playground`; verify learning goal, steps, and metadata are present; request an unknown lab slug and receive a clear not-found.

**Acceptance Scenarios**:

1. **Given** an authenticated learner and lab slug `index-playground`, **When** they call the dedicated lab-summary read API for that slug, **Then** they receive title, learning goal (B-Tree index impact), ordered guided steps, and enough narrative to start the before/after experiment.
2. **Given** a successful summary response, **When** the client inspects it, **Then** it includes references or links sufficient to discover related quiz and progress actions for this lab (without embedding full quiz answer keys).
3. **Given** an unknown lab slug, **When** summary is requested, **Then** the client receives a clear not-found response.
4. **Given** an unauthenticated caller, **When** they request the lab summary, **Then** the request is rejected as unauthorized (MVP learning APIs require auth).

---

### User Story 2 - Before/After Query Experiment With Index Actions (Priority: P1)

A learner runs a selective lookup query on the playground dataset **without** a helpful index, observes a slow sequential-style scan and high rows scanned, then creates a B-Tree index on the filter column, runs the same query again, and sees index-backed access with far fewer rows scanned and much lower execution time—matching the PRD Index Lab experience.

**Why this priority**: This is the core learning experiment; everything else supports this before/after loop.

**Independent Test**: On a prepared commerce (or lab) dataset session for Index Playground: run the guided lookup SQL (execution time visible); create the lab’s recommended index; re-run the same SQL; use Explain before/after to verify scan-type and rows-scanned improvement; drop index and verify regression via Explain.

**Acceptance Scenarios**:

1. **Given** a prepared playground session for Index Playground with no lab index on the target column, **When** the learner runs the guided selective query via existing experiment execution, **Then** results succeed with execution-focused metrics (e.g. execution time, rows returned)—scan type is not required on this plain SQL path.
2. **Given** the same session, **When** the learner submits the recommended `CREATE INDEX` SQL via existing experiment execution (sandbox allowlist), **Then** the index is created successfully and the operation result confirms success (no separate create-index API).
3. **Given** the index exists, **When** the learner re-runs the same guided query, **Then** execution time is substantially lower than the before run on the same dataset tier (when the index is used by the planner).
4. **Given** the index exists, **When** the learner submits the recommended `DROP INDEX` SQL via existing experiment execution, **Then** the index is removed and a subsequent guided query run is slower again under normal teaching conditions.
5. **Given** a create/drop index outside sandbox allowlist (wrong table, dangerous DDL), **When** submitted as SQL, **Then** execution is blocked with a categorized sandbox violation (existing sandbox behavior; lab must not weaken it).

---

### User Story 3 - Explain Analyze Integration for Index Comparison (Priority: P1)

The learner requests explain (or explain analyze) for the guided query before and after creating the index. **Explain is the primary source** of scan type and rows scanned for before/after comparison. The platform returns plan information and Metric Contract fields—without the frontend inventing planner metrics.

**Why this priority**: ROADMAP Index Lab lists Explain Analyze as a required feature; scan-type teaching depends on planner output (clarified as primary comparison path).

**Independent Test**: Run explain for the guided query without index and with index; verify plan/metrics expose scan type and row-related values suitable for before/after comparison.

**Acceptance Scenarios**:

1. **Given** no helpful index, **When** the learner runs explain (or explain analyze) for the guided query through the existing explain path scoped to this lab, **Then** the response includes plan node information showing sequential/non-index access and Metric Contract entries for scan type and rows scanned.
2. **Given** the lab index exists, **When** explain is run for the same query, **Then** the response shows index-backed access and updated row/cost/time metrics consistent with the plan.
3. **Given** explain results used for lab comparison, **When** metrics are present, **Then** they use the shared Metric Contract shape and MUST include scan type and rows scanned (and execution/planning time when explain analyze is used).
4. **Given** lab summary guided steps, **When** the learner follows them, **Then** steps instruct using Explain before and after index creation for scan-type comparison (not relying on plain SQL run metrics for scan type).

---

### User Story 4 - Metrics Payload for Charts (Scan Type & Rows) (Priority: P1)

After **explain** runs in this lab (primary), and optionally after SQL/benchmark runs, the backend exposes a stable metrics payload (and/or persisted snapshots via Metrics Pipeline). Scan type and rows scanned MUST be present on explain-derived snapshots so a future FE can chart before/after without recomputing engineering metrics.

**Why this priority**: BACKLOG deliverable and constitution: metrics originate from backend only.

**Independent Test**: Complete explain before and after index creation; fetch metrics/history for those runs; verify scan type and rows scanned are present and distinguishable; plain SQL run snapshots may omit scan type.

**Acceptance Scenarios**:

1. **Given** a completed explain (or explain analyze) for the guided query, **When** metrics are returned with the result or read from metric history for this lab, **Then** entries include scan type and rows scanned (plus planning/execution time when measured).
2. **Given** before and after explain snapshots in the same learning session, **When** the client compares them, **Then** it can distinguish non-index vs index-backed outcomes using backend values only.
3. **Given** metric keys for this lab, **When** documented/returned, **Then** they align with the Database Track Metric Catalog concepts (execution time, rows scanned, rows returned, index used, scan type) without inventing a parallel private contract.
4. **Given** a plain SQL experiment run (no explain), **When** metrics are returned, **Then** execution-focused metrics are sufficient; absence of scan type on that path is acceptable.

---

### User Story 5 - Optional Benchmark Mention (Priority: P2)

Lab summary MAY mention an optional next step: benchmark the guided query before/after the index using the **existing** Benchmark Runner APIs (no new benchmark endpoints in this feature). P1 delivery does **not** require benchmark acceptance tests.

**Why this priority**: ROADMAP lists Benchmark under Index Lab as reinforcing; clarified as optional/P2 so lab summary + SQL + explain ship first.

**Independent Test**: Lab summary either omits benchmark or documents calling existing benchmark enqueue with the guided query; no Index-Playground-specific benchmark API exists; P1 stories pass without running benchmarks.

**Acceptance Scenarios**:

1. **Given** Index Playground P1 scope, **When** lab summary / SQL / explain paths are verified, **Then** they succeed without depending on benchmark jobs.
2. **Given** lab summary includes an optional benchmark step, **When** the client follows it, **Then** it uses existing Benchmark Runner contracts only (same as other labs)—no new Index Playground benchmark API.
3. **Given** benchmark is skipped, **When** the learner completes explain before/after and the quiz, **Then** learning completion still works.

---

### User Story 6 - Quiz Alignment for Index Playground (Priority: P2)

The lab’s quiz (already seeded via Quiz Engine for `index-playground`) remains the completion gate. This feature ensures lab summary surfaces quiz availability and that quiz content validates index/scan concepts; it does not re-implement Quiz Engine.

**Why this priority**: BACKLOG lists quiz definitions and summary API; quiz engine already exists—this story is alignment and summary linkage, not a new scoring system.

**Independent Test**: Fetch lab summary and quiz definition for `index-playground`; verify quiz exists and summary indicates quiz-gated completion; passing quiz still completes the lab via existing Quiz Engine behavior.

**Acceptance Scenarios**:

1. **Given** lab `index-playground`, **When** quiz definition is requested via Quiz Engine, **Then** a quiz exists with questions covering index vs sequential scan concepts (seed may be extended if current seed is insufficient).
2. **Given** the lab summary, **When** inspected, **Then** it indicates that progress completion requires passing the lab quiz.
3. **Given** a learner passes the quiz, **When** progress is read, **Then** Index Playground appears completed (existing Quiz Engine + Progress Tracking behavior; no regression).

---

### Edge Cases

- What happens if the dataset is not prepared for the session? Reject or guide with a clear error to prepare/reset dataset before running guided experiments.
- What happens if the learner creates a different index than the guided one? Allowed if sandbox permits; guided comparison guarantees apply to the lab’s recommended index/query pair; educational messaging may note the recommended path.
- What happens if the planner chooses seq scan even with an index (tiny table / bad stats)? Lab MUST use a dataset tier and query selective enough that index use is the expected plan in normal conditions; if planner still avoids the index, return honest plan/metrics and an educational hint rather than faking metrics.
- What happens on concurrent create/drop index in one session? Last successful DDL wins; subsequent queries reflect current indexes.
- What happens on playground reset? Indexes created in-session are cleared with disposable playground state; lab returns to deterministic baseline (Dataset Reset).
- What happens for FE chart rendering? Out of scope; backend only supplies Metric Contract payloads and lab summary.
- What happens for Redis Track or other labs? Out of scope; this feature is Index Playground only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a dedicated authenticated lab-summary read API scoped by lab slug (Index Playground first; shape reusable for later labs), including learning goal, guided steps, recommended SQL/index, and quiz-gated completion indication—not merely an extension of Track catalog list fields.
- **FR-002**: System MUST support the Index Playground before/after learning loop using existing Experiment Runner + SQL Sandbox paths only: run guided SELECT, submit `CREATE INDEX` / `DROP INDEX` as SQL, re-run SELECT—no dedicated create-index/drop-index endpoints.
- **FR-003**: System MUST ensure create/drop index SQL for this lab remain within sandbox allowlist on playground tables only (no platform schema mutation); lab summary MUST document the recommended DDL strings learners submit.
- **FR-004**: System MUST integrate Explain Runner for the guided query so learners can compare plans before and after index creation; Explain / Explain Analyze is the **primary** source of scan type and rows scanned for lab comparison.
- **FR-005**: System MUST return Metric Contract metrics on explain results that include at least scan type and rows scanned (and planning/execution time when explain analyze is used); index-used indicator SHOULD be present when derivable from the plan. Plain SQL experiment runs MUST return execution-focused metrics and are NOT required to include scan type.
- **FR-006**: System MUST persist or expose metric history for Index Playground explain (and other) runs via existing Metrics Pipeline patterns so before/after explain snapshots can be compared.
- **FR-007**: System MUST define the canonical guided query as a parameterized selective lookup on `users.email` (equality) and the recommended B-Tree index on `users(email)`, both documented in lab summary; guided steps MUST include Explain before and after index creation.
- **FR-008**: System MUST keep Index Playground quiz-gated via existing Quiz Engine; extend quiz seed content if needed so questions validate index vs sequential scan learning goals.
- **FR-009**: System MUST NOT implement frontend charts, editors, or visualization kits in this feature.
- **FR-010**: System MUST NOT implement Redis or non-SQL runtimes in this feature.
- **FR-011**: System MUST reuse Dataset Loader / Reset and Experiment Isolation session preparation rather than inventing a parallel dataset stack for this lab.
- **FR-012**: System MAY document an optional benchmark step in lab summary that points at existing Benchmark Runner usage for the guided query; System MUST NOT add Index-Playground-specific benchmark APIs; benchmark acceptance tests MUST NOT block P1 Done.
- **FR-013**: System MUST return educational, Track-aware errors when guided steps fail (timeout due to sequential scan, sandbox violation on bad DDL, dataset not ready)—not opaque generic failures.
- **FR-014**: System MUST scope this feature to lab slug `index-playground` on track `database-sql` (already present in catalog seed).

### Key Entities

- **Index Playground Lab**: Catalog lab (`index-playground`) with learning goal, guided steps, and quiz gate.
- **Lab Summary**: Read model for FE/clients—title, goal, theory blurb, ordered steps, recommended SQL, recommended index DDL, quiz indicator.
- **Guided Experiment Pair**: Canonical parameterized `users` email lookup + recommended B-Tree index on `users(email)` for reproducible teaching.
- **Run Metrics Snapshot**: Metric Contract set for a run (scan type, rows scanned, rows returned, execution time, index used) tied to lab/session/user as per Metrics Pipeline.
- **Index DDL (guided)**: Recommended `CREATE INDEX` / `DROP INDEX` SQL strings in the lab summary; executed only through existing sandboxed experiment SQL execution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated lab tests on the default teaching dataset tier, **explain** of the guided query without the recommended index reports a non-index scan type, and with the recommended index reports an index-backed scan type, in ≥95% of fresh prepared sessions.
- **SC-002**: In the same explain-based tests, rows scanned after index creation are at least 10× lower than before (or rows scanned after ≤ rows returned × small constant) for the guided selective query.
- **SC-003**: Learners following the lab summary steps can complete the before → explain → create index → after → explain loop (excluding quiz) in under 10 minutes when the dataset is already prepared.
- **SC-004**: 100% of successful guided **explain** responses used in the lab comparison path include scan type and rows scanned in Metric Contract form.
- **SC-005**: Lab summary for `index-playground` is available to authenticated users and includes at least 3 guided steps covering before, create index, and after, with Explain called out for scan-type comparison.
- **SC-006**: Passing the Index Playground quiz marks the lab complete in progress reads (no regression vs Quiz Engine).
- **SC-007**: No Index Playground API requires the client to compute scan type or rows scanned locally from raw plans when using the lab’s supported explain responses.

## Assumptions

- Dataset Loader, Experiment Runner, Explain Runner, Metrics Pipeline, SQL Sandbox, Experiment Isolation, Dataset Reset, Quiz Engine, and Progress Tracking are Done and reusable.
- Lab row `index-playground` and a baseline quiz seed already exist; this feature may extend summary content and quiz questions but should not rename the slug.
- Default teaching dataset is the existing commerce family playground dataset at a tier large enough for sequential vs index difference to be obvious (e.g. 100k+); guided query targets `users.email` (unindexed in baseline schema) with recommended index on `users(email)`.
- Frontend visualization is explicitly deferred; APIs and metrics must still be chart-ready.
- Redis Sandbox and other Tracks are out of scope.
- Authentication is required for lab summary and experiment paths consistent with current learning APIs.
- Benchmark is optional/P2: mention-only via existing Benchmark Runner; not required for Index Playground P1 Done. Heavy RPS tiers belong to Benchmark Lab.

## Out of Scope

- Frontend UI, charts, SQL editor chrome, and visualization kits
- Redis Track / Playground Redis
- Other Database Track labs (Explain Analyze Lab, Offset vs Cursor, Benchmark Lab) beyond shared runtime reuse
- New Index Playground benchmark APIs or benchmark acceptance tests as P1 gates
- New sandbox engine or weakening sandbox allowlists
- Rewriting Quiz Engine, Metrics Pipeline, or Benchmark Runner internals except lab-specific wiring/content
- Theory CMS / rich media authoring beyond the lab summary contract needed for MVP
