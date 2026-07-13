# Feature Specification: React Sandbox Runtime

**Feature Branch**: `025-react-sandbox-runtime`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Provide the Headless React Sandbox Runtime Adapter that executes React scenarios and emits the react-metrics Metric Contract, resolvable through the Runtime Adapter registry by track slug (ROADMAP §Frontend React Track). Deliverables: Runtime Adapter registered and dispatched by a track-agnostic experiment run path; real headless React execution per scenario input (component definition, props, interactions, memo/key options); Metric Contract output from react-metrics (render_count, commit_duration_ms, component_tree_depth, nodes_reused, nodes_remounted, dom_mutations, remount_count, memo_hit_rate, effect_run_count, captured_value, stale_reads); learner-facing experiment entry point resolving the adapter by track; timeouts and resource limits; no dependency on Playground PostgreSQL."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-13

- Q: How should the sandbox obtain the component definition to execute? → A: Built-in fixture IDs only (props/interactions/options vary); no source-string execution in MVP.
- Q: How should `commit_duration_ms` be produced for learning and tests? → A: Real measured commit duration; tests use relative comparisons / tolerance bands.
- Q: What should `dom_mutations` mean in a headless (no browser DOM) sandbox? → A: Count observed host-tree / fiber mutations during reconcile (headless equivalent of DOM ops).
- Q: May any authenticated learner invoke any registered fixture ID, or must it be allowlisted for the current lab? → A: Fixture ID must be allowlisted for the current lab (or present in that lab’s guided content).
- Q: What interactive latency target should a typical successful React experiment run meet under normal load? → A: p95 under 2 seconds for typical seeded fixtures (≤10 interactions).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner Runs a React Scenario and Sees Metrics (Priority: P1)

A learner in a Frontend React Track lab triggers a guided experiment step (mount, update props/state, remount, compare reconciliation, inspect hooks, etc.). The platform executes the lab's React scenario in an isolated headless sandbox and returns backend-owned Metric Contract values so the learner can observe render cost, reconciliation behavior, or hook effects without the frontend computing engineering metrics.

**Why this priority**: Without a working Headless React Runtime Adapter that emits real measurements, no Frontend React lab can teach internals through experimentation.

**Independent Test**: Submit a known Rendering Lab scenario (mount then state update) and verify the response includes Metric Contract entries for `render_count`, `commit_duration_ms`, and `component_tree_depth` with values consistent with the executed interactions — not hardcoded placeholder formulas divorced from an actual render pass.

**Acceptance Scenarios**:

1. **Given** an authenticated learner, a lab context, and a fixture ID allowlisted for that lab, **When** they run a render/update experiment step, **Then** the platform returns Metric Contract entries drawn from the `react-metrics` catalog for that scenario's measurement set.
2. **Given** two runs of the same scenario with different interaction sequences (e.g., no updates vs multiple state updates), **When** both complete successfully, **Then** metric values differ in a way that reflects the interaction difference (e.g., higher `render_count` when more updates occur).
3. **Given** a successful run, **When** results are returned, **Then** the frontend can display metrics using backend `key`, `label`, `unit`, `value`, and `group` fields without deriving render counts or commit duration itself.
4. **Given** a React experiment request, **When** it executes, **Then** it MUST NOT read from or write to Playground PostgreSQL for scenario execution or metric collection.

---

### User Story 2 - Runtime Resolves by Track and Stays Adapter-Agnostic (Priority: P1)

The platform routes Frontend React experiments through the shared Runtime Adapter registry using the track's declared adapter type / track slug. Application orchestration does not hard-code React-specific execution paths outside the adapter boundary. Database Track experiments continue to use the PostgreSQL adapter without cross-contamination.

**Why this priority**: DOMAIN and ARCHITECTURE require Tracks to plug in via Runtime Adapters; a track-agnostic run path is the infrastructure contract for multi-track growth.

**Independent Test**: Resolve the adapter for the Frontend React track slug and execute a scenario; resolve the Database track adapter separately and confirm React requests never invoke PostgreSQL experiment execution.

**Acceptance Scenarios**:

1. **Given** the Frontend React track is registered with the headless React sandbox adapter type, **When** a React experiment is requested for that track, **Then** the headless React adapter handles execution.
2. **Given** a request for an unknown or unsupported track adapter, **When** resolution fails, **Then** the learner receives a clear not-found / unsupported-runtime error without partial execution.
3. **Given** a Database Track experiment request, **When** it runs, **Then** behavior is unchanged by the presence of the React adapter (no shared mutable runtime state between adapters).
4. **Given** track metadata declares Metric Catalog `react-metrics`, **When** React metrics are emitted, **Then** only keys defined in that catalog appear in the success payload for MVP.

---

### User Story 3 - Enforce Timeouts and Resource Limits (Priority: P1)

When a React scenario runs too long, allocates too much memory, or exceeds fair-use interaction/complexity bounds, the sandbox terminates or rejects the run and returns a categorized, educational error so the learner understands the boundary.

**Why this priority**: Shared playground capacity and multi-tenant safety require the same class of guardrails as SQL and Redis sandboxes.

**Independent Test**: Submit a scenario configured to exceed the per-run timeout or interaction/complexity cap; verify a categorized timeout or resource-limit error with actionable learner messaging and no success metrics attached.

**Acceptance Scenarios**:

1. **Given** a scenario exceeds the configured per-run timeout, **When** the sandbox terminates it, **Then** the learner receives a timeout error with guidance relevant to React lab context (e.g., simplify interactions or component work).
2. **Given** a scenario exceeds configured interaction count, tree-size, or memory bounds, **When** validation or runtime enforcement runs, **Then** execution is blocked or stopped with a resource-limit error explaining the bound.
3. **Given** missing deploy-time limit configuration, **When** the sandbox starts, **Then** safe defaults apply so the runtime never runs without timeout and resource caps.
4. **Given** a run fails due to timeout or limits, **When** the error response is returned, **Then** no partial success metrics are presented as if the experiment completed successfully.

---

### User Story 4 - Scenario Inputs Drive Measurable Behavior (Priority: P1)

Each run resolves a **built-in fixture ID** to a platform-owned component scenario. Learners (via guided steps / Input Surface) vary props, interactions, and options such as memoization and key strategy — not component source text. The sandbox applies those inputs so metric differences teach the intended concept (re-renders, reconciliation, memo hits, stale closures).

**Why this priority**: Pedagogy depends on controllable inputs producing observable metric changes; without this, labs cannot demonstrate cause and effect.

**Independent Test**: Run the same base scenario twice — once with memoization off and once on (or index keys vs stable keys) — and verify metric differences align with the teaching goal for that option.

**Acceptance Scenarios**:

1. **Given** a scenario with props and a sequence of interactions, **When** the sandbox executes it, **Then** metrics reflect mount plus the applied interactions (not an empty no-op run).
2. **Given** `options.memo` is toggled between runs for a memoization-relevant scenario, **When** both runs succeed, **Then** memo-related metrics (e.g., `memo_hit_rate` and/or render counts) differ in the expected direction for the lab.
3. **Given** `options.keyStrategy` differs between reconciliation runs, **When** both succeed, **Then** reconciliation metrics (`nodes_reused`, `nodes_remounted`, `dom_mutations`, `remount_count`) differ in the expected direction, with `dom_mutations` reflecting observed host-tree / fiber mutations during reconcile.
4. **Given** a hooks/closure scenario, **When** the learner triggers the inspect/compare step, **Then** hook-related metrics (`effect_run_count`, `captured_value`, `stale_reads` as applicable) are present and consistent with the scenario definition.

---

### User Story 5 - Learners Receive Actionable Errors (Priority: P2)

When a scenario fails — invalid input, unsupported action, sandbox violation, timeout, or runtime fault — the learner receives a categorized, Track-aware error that explains what went wrong and what to try next, not an opaque internal failure.

**Why this priority**: Learning-first UX requires teachable errors; secondary to successful measurement paths but required for trustworthy labs.

**Independent Test**: Submit fixtures for validation failure, cross-lab fixture probe, unsupported action, timeout, and runtime fault; verify each returns a distinct category and educational message without leaking internal stack traces to learners.

**Acceptance Scenarios**:

1. **Given** missing or malformed scenario input, **When** validation runs, **Then** the request is rejected with a clear validation error before sandbox execution.
2. **Given** a registered fixture ID that is not allowlisted for the requested lab, **When** the learner attempts to run it, **Then** the request is rejected with a clear not-allowed error before sandbox execution.
3. **Given** an unsupported guided action for the React runtime, **When** the request is processed, **Then** the learner receives an unsupported-action error listing allowed action classes for the track.
4. **Given** the component scenario throws during execution, **When** the sandbox catches it, **Then** the learner receives a categorized runtime error with a safe message (no sensitive host internals).
5. **Given** an unauthenticated caller, **When** they attempt to run a React experiment, **Then** the request is rejected per platform auth rules.

---

### Edge Cases

- What happens when the fixture ID is unknown or not registered? Reject with validation / not-found; do not invent a default teaching fixture silently.
- What happens when the fixture ID is registered globally but not allowlisted for the requested lab? Reject with not-allowed before sandbox execution.
- What happens when interactions array is empty? Execute a single mount (or action-defined baseline) and return metrics for that baseline; do not fabricate fake update metrics.
- What happens when memo/key options are omitted? Apply scenario defaults (memo off; stable keys unless scenario specifies otherwise) and document defaults in responses/notes where helpful for learning.
- What happens when the React runtime is temporarily unavailable? Return a categorized infrastructure error; do not fall back to PostgreSQL or to a silent deterministic fake that pretends a real profiler ran.
- What happens for concurrent runs from the same learner? Each request is independent (stateless per run); metrics history, if any, remains the responsibility of Metrics Pipeline session rules.
- What happens when catalog metrics are not applicable to an action (e.g., reconciliation metrics on a pure render step)? Omit inapplicable keys rather than zero-filling with misleading values; include the measurement set defined for that action/scenario.
- What happens when a deterministic placeholder still exists during migration? Feature Done requires real headless execution; placeholder-only responses MUST NOT be accepted as the completed runtime for production labs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Headless React Sandbox Runtime Adapter that executes Frontend React Track experiments without using Playground PostgreSQL for scenario execution or React metric collection.
- **FR-002**: System MUST register the adapter in the Runtime Adapter registry and resolve it by the Frontend React track's declared adapter identity / track slug for experiment runs.
- **FR-003**: System MUST expose a learner-facing experiment entry point that accepts React scenario input (action + scenario payload) and returns structured results including Metric Contract entries.
- **FR-004**: System MUST execute scenarios with a real headless React render/profile pass (not a formula-only placeholder) so metrics originate from observed render/reconcile/hook behavior for the given inputs.
- **FR-005**: System MUST resolve each run to a **built-in fixture ID** registered for Frontend React labs, require **lab context**, reject fixture IDs not allowlisted for that lab (or not referenced by that lab’s guided content) before execution, then apply learner-controlled props, interactions, and options (`memo`, `keyStrategy`) within lab policy bounds.
- **FR-006**: System MUST reject requests that supply executable component source strings (including trusted admin `componentSource` text execution); MVP executes only built-in fixtures — source-string execution is out of scope.
- **FR-007**: System MUST enforce a configurable per-run timeout with a safe default suitable for interactive labs.
- **FR-008**: System MUST enforce configurable resource caps including maximum interactions per run, maximum component tree complexity / item count, and a memory/time bound, with safe defaults.
- **FR-009**: System MUST categorize failures distinctly among validation errors, not-allowed (lab fixture allowlist), unsupported actions, sandbox/policy violations, timeouts, resource limits, and runtime/infrastructure errors.
- **FR-010**: System MUST return learner-facing error messages that are actionable and educational (React Track-aware), not opaque generic failures.
- **FR-011**: System MUST emit metrics using the shared Metric Contract for the `react-metrics` catalog keys required by the executed scenario/action, including (as applicable): `render_count`, `commit_duration_ms`, `component_tree_depth`, `nodes_reused`, `nodes_remounted`, `dom_mutations`, `remount_count`, `memo_hit_rate`, `effect_run_count`, `captured_value`, `stale_reads`. `commit_duration_ms` MUST be **real measured commit/profile timing** from the headless run (not a count-only formula). `dom_mutations` MUST count **observed host-tree / fiber structure mutations** during reconcile (headless stand-in for DOM ops), not a secondary formula from remount/reuse deltas alone.
- **FR-012**: System MUST omit inapplicable catalog metrics for a given action rather than emitting misleading zeros.
- **FR-013**: System MUST require authentication for React sandbox experiment execution in MVP.
- **FR-014**: System MUST keep React sandbox state disposable per experiment run (no cross-learner shared component state; no persistence of headless trees across unrelated requests).
- **FR-015**: System MUST log sandbox violations and runtime failures with request correlation identifiers without logging full component source or large props payloads in production logs.
- **FR-016**: System MUST NOT implement Frontend React lab curricula, quizzes, or FE charts in this feature — only the runtime adapter, limits, experiment entry point, and metric emission.
- **FR-017**: System MUST preserve Database (and other) Track experiment behavior; adding the React adapter MUST NOT change non-React experiment contracts.

### Key Entities

- **React Experiment Request**: Authenticated learner request combining lab context, guided `action`, **fixture ID**, props, interactions, and options.
- **React Fixture**: Built-in, platform-owned scenario identified by fixture ID; maps to a concrete headless component tree and default props/options; must be allowlisted per lab for learner runs.
- **Lab Fixture Allowlist**: Association between a lab and the fixture IDs learners may execute in that lab (from guided content or explicit lab policy).
- **Sandbox Policy**: Allowed actions, timeout default, interaction/complexity/memory caps, and policy version.
- **React Experiment Result**: Success/failure outcome, optional execution notes for learning, raw execution summary suitable for FE debugging displays, and Metric Contract entries.
- **Metric Snapshot (React)**: Metric Contract entries from the `react-metrics` catalog for a single run / measurement window.
- **Runtime Adapter Binding**: Track-to-adapter resolution record (Frontend React → headless React sandbox).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For scripted Rendering Lab fixtures (mount + N state updates), returned `render_count` matches the expected render passes from the headless run in 100% of automated cases.
- **SC-002**: Toggling memoization on a memoization fixture changes `memo_hit_rate` and/or `render_count` in the expected direction in 100% of automated comparison tests.
- **SC-003**: Toggling key strategy on a reconciliation fixture changes `nodes_reused` / `nodes_remounted` in the expected direction in 100% of automated comparison tests.
- **SC-004**: A run configured to exceed the timeout is terminated and returns a categorized timeout response within 5 seconds of the limit boundary under normal load.
- **SC-005**: 100% of known invalid/malformed request fixtures are rejected before sandbox execution in automated tests.
- **SC-006**: Every successful learner-facing React experiment response includes only Metric Contract keys from the `react-metrics` catalog and never requires the frontend to compute those engineering values.
- **SC-007**: Learners can complete a basic render → update → compare-metrics learning loop in under 2 minutes when following lab instructions, with metrics visible from backend responses alone.
- **SC-008**: Automated checks confirm React experiment execution does not touch Playground PostgreSQL connections/query paths.
- **SC-009**: Automated tests for `commit_duration_ms` assert non-negative real measurements and relative/tolerance-band expectations (e.g., a heavier interaction sequence is not faster than a lighter one beyond tolerance) — never exact millisecond equality.
- **SC-010**: 100% of cross-lab fixture probes (valid fixture ID, wrong lab) are rejected before sandbox execution in automated tests.
- **SC-011**: Under normal load, p95 end-to-end latency for a successful typical seeded fixture run (≤10 interactions) is under 2 seconds.

## Assumptions

- Frontend React Track Bootstrap and Metrics Pipeline are Done; `react-metrics` catalog keys and seeded lab scenarios already exist.
- MVP resolves scenarios via **built-in fixture IDs** only (seeded with Frontend React labs). Learners vary props, interactions, and options. Executable `componentSource` strings — whether from learners or admin content — are out of scope until a hardened code-sandbox feature is specified.
- Learner runs MUST include lab context; fixture IDs are allowlisted per lab via guided content (or explicit lab policy). Cross-lab fixture IDs are rejected before execution.
- A temporary deterministic placeholder may exist during development; **Done** means real headless profiling replaces placeholder formulas for production lab traffic.
- `commit_duration_ms` is wall-clock/profile-measured; CI asserts relative order or tolerance bands, not exact equality.
- `dom_mutations` is the count of observed host-tree / fiber mutations during reconcile (no browser DOM required); it is not omitted in MVP and is not derived solely from remount/reuse arithmetic.
- Default per-run timeout is 5 seconds unless overridden by configuration.
- Default max interactions per run is 50; default max list/item complexity is 500 items; default memory soft guidance follows platform sandbox norms unless overridden.
- Experiment execution is synchronous per request for MVP (no separate worker queue required for React runs).
- Interactive latency target: p95 under 2 seconds for typical seeded fixtures with ≤10 interactions under normal load (separate from the hard per-run timeout).
- Authentication is required; anonymous React sandbox execution is out of scope.
- Per-user rate limiting remains the responsibility of the existing Per-User Rate Limit feature.
- Metric history / compare-before-after persistence reuses Metrics Pipeline session rules where applicable; this feature guarantees inline metrics on the experiment response.
- Individual Frontend React labs (Rendering, Reconciliation, Keys, Closure/Hooks) remain separate backlog features that depend on this runtime for real measurements and finalized quizzes.

## Out of Scope

- Frontend React lab curriculum text, guided-step authoring UX, and quiz content finalization (Rendering Lab and sibling lab features)
- Frontend charts, component editors, and Visualization Kit rendering (FE-owned; consumes Metric Contract only)
- Playground PostgreSQL, SQL sandbox, Redis sandbox, or Benchmark runner changes
- Arbitrary learner-uploaded component source execution; trusted admin `componentSource` string execution; remote code execution hardening beyond built-in fixtures
- Browser Performance Track (layout/paint/composite) or full DOM browser profiling
- Changing Track Registry schema beyond using existing Frontend React track metadata
- Anonymous (unauthenticated) React experiment execution
