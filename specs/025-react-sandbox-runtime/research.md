# Research: React Sandbox Runtime

**Feature**: 025-react-sandbox-runtime | **Date**: 2026-07-13

## 1. Module Boundary

**Decision**: Extend existing `RuntimeAdapterModule` with React HTTP orchestration (`RunReactExperimentUseCase` + controller). Keep track-agnostic `RunExperimentUseCase` / registry unchanged.

**Rationale**: React adapter, registry, and shared runtime contracts already live here. Unlike SQL, there is no separate sandbox or dataset module to orchestrate. A new Nest module would only add indirection.

**Alternatives considered**:
- **New `react-experiment-runner` module**: Mirrors SQL’s split; rejected — no second infrastructure dependency to wrap.
- **Put HTTP on `experiment-runner` controller**: Couples Database Track module to React fixtures; rejected.

## 2. Headless Execution Engine

**Decision**: Use **React + `react-test-renderer`** with the **Profiler** API (and custom host-tree observation hooks) to drive mounts, updates, remounts, and option toggles for built-in fixtures.

**Rationale**: Fits Node backend, widely used for headless render tests, supports Profiler `actualDuration` for `commit_duration_ms`, and can expose host instance create/update/delete counts for `dom_mutations` without a browser DOM.

**Alternatives considered**:
- **Custom `react-reconciler` host config only**: More control, higher complexity; deferred unless test-renderer cannot surface mutation counts.
- **Puppeteer / jsdom full browser**: Out of scope (Browser Performance Track); slower; rejected for MVP.
- **Keep deterministic `deriveReactMetrics`**: Fails FR-004 / Done criteria; rejected for production path.

## 3. Fixture Model (no `componentSource`)

**Decision**: Code-registered **fixture registry** keyed by `scenarioId` / fixture ID (`rendering/counter`, …). Request supplies fixture id + props/interactions/options. Any `componentSource` field is rejected with validation error.

**Rationale**: Matches clarification (built-in fixtures only). Seeded labs already use these ids. Avoids server-side eval of arbitrary JSX/JS.

**Alternatives considered**:
- **Trusted admin `componentSource` eval**: Clarification rejected for MVP.
- **Learner-uploaded source**: Out of scope / security risk.

## 4. Lab Fixture Allowlist

**Decision**: On each run, require `labSlug`. Load that lab’s guided steps (existing Lab Flow / lab summary repository). Allow fixture id only if some step’s `payload.reactScenario.scenarioId` equals the requested fixture id (or an explicit allowlist field if later added). Otherwise `NOT_ALLOWED` before execution.

**Rationale**: Clarification B — lab-scoped access. Reuses seeded content without new tables.

**Alternatives considered**:
- **Any authenticated user → any fixture**: Rejected by clarification.
- **Hardcoded map labSlug → fixtures in code**: Duplicates seed data; drifts from admin edits; rejected as primary source (code map OK as fallback only if DB empty during tests — prefer DB).

## 5. HTTP Contract & Auth

**Decision**: `POST /api/v1/experiments/react/run` with JWT required (not `@Public()`). Body: `action`, `fixtureId` (or `scenario.scenarioId`), `labSlug`, optional `trackSlug`, `props`, `interactions`, `options`. Response: `RuntimeExperimentResult` shape with `metrics[]` + `raw` notes.

**Rationale**: Spec FR-013 requires auth. Mirrors SQL route namespace for FE discoverability while remaining React-specific for validation.

**Alternatives considered**:
- **Public like current SQL run**: Violates React spec assumption/FR-013.
- **Generic `POST /experiments/run` with adapterType**: Nice long-term; deferred — SQL path already specialized; avoid breaking change in this feature.

## 6. Timeouts & Resource Caps

**Decision**: Config keys `reactSandbox.timeoutMs` (default 5000), `maxInteractions` (50), `maxItems` (500). Enforce interaction/item caps pre-flight; wrap adapter `run` in `Promise.race` against timeout. On timeout → `TIMEOUT` DomainError, no success metrics.

**Rationale**: Spec FR-007/008 and Assumptions. Synchronous MVP needs hard bounds.

**Alternatives considered**:
- **Worker queue**: Spec assumes sync; rejected for MVP.
- **No latency SLO, timeout only**: Clarification chose p95 &lt; 2s as soft goal plus hard timeout.

## 7. Metric Semantics

**Decision**:
- `commit_duration_ms`: sum (or max-commit) of Profiler `actualDuration` across commits in the run — real measured; tests use relative/tolerance bands.
- `dom_mutations`: count of observed host-tree create/update/delete operations during the run (test-renderer host callbacks / fiber commit instrumentation) — not remount arithmetic alone.
- Other catalog keys: derived from profiler + fixture instrumentation (render counts, reuse/remount, memo hits, effect/stale reads) as applicable per action; omit inapplicable keys.

**Rationale**: Clarifications A/A for timing and mutations; FR-011/012.

**Alternatives considered**:
- **Bucketed / synthetic duration**: Rejected by clarification.
- **Omit `dom_mutations`**: Rejected by clarification.

## 8. Relationship to Placeholder Model

**Decision**: Production `ReactRuntimeAdapter` must call the real profiler path. Remove or quarantine `deriveReactMetrics` so it cannot be the production default. Unit tests that asserted placeholder formulas are rewritten against fixture + profiler observations (deterministic structural metrics; tolerant timing).

**Rationale**: Spec edge case — placeholder-only is not Done.

**Alternatives considered**:
- **Feature-flag placeholder fallback in prod**: Risks silent fake metrics; rejected.

## 9. Shared Type Tightening

**Decision**: Keep `ReactScenarioPayload.componentSource` optional in shared types for forward compatibility with admin content, but **runtime validation rejects** any request that includes a non-empty `componentSource`. Prefer request DTO field `fixtureId` aligned with `scenario.scenarioId`.

**Rationale**: Avoid breaking existing lab summary JSON shape while enforcing MVP policy at the experiment boundary.

**Alternatives considered**:
- **Delete `componentSource` from shared type now**: Forces contract churn across lab-flow; deferred.
