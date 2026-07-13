# Data Model: React Sandbox Runtime

**Feature**: 025-react-sandbox-runtime | **Date**: 2026-07-13

No new Platform DB tables. Runtime state is per-request and disposable. Allowlist is derived from existing lab guided-step payloads.

## ReactExperimentRequest (HTTP / use case input)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `action` | string | yes | Guided-step action (`render_component`, `update_state`, `update_props`, `remount`, `toggle_memo`, `compare_reconciliation`, `inspect_hooks`, …) |
| `fixtureId` | string | yes | Built-in fixture id (same values as seeded `reactScenario.scenarioId`) |
| `labSlug` | string | yes | Lab context for allowlist |
| `trackSlug` | string | no | Defaults to `frontend-react` when omitted |
| `props` | `Record<string, unknown>` | no | Overrides fixture default props |
| `interactions` | `ReactInteraction[]` | no | Ordered updates/events |
| `options` | `ReactScenarioOptions` | no | `memo`, `keyStrategy`, … |
| `requestId` | string | no | Correlation id |

### Rejected fields (MVP)

| Field | Behavior |
| ----- | -------- |
| `componentSource` | If present and non-empty → `VALIDATION_ERROR` before execution |

## ReactInteraction

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `type` | string | yes | e.g. `click`, `setstate`, `setprops` |
| `payload` | unknown | no | Interaction-specific data |

## ReactScenarioOptions

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `memo` | boolean | no | Default `false` |
| `keyStrategy` | `'index' \| 'stable'` | no | Default `stable` |

## ReactFixture (code registry entry)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `id` | string | Stable fixture id |
| `createElement` | factory | Builds root element given props/options |
| `supportedActions` | string[] | Actions this fixture understands |
| `defaultProps` | object | Baseline props |
| `measurementSet` | string[] | Catalog keys typically emitted |

### Seeded fixture ids (MVP)

| Fixture id | Lab (allowlist via guided steps) |
| ---------- | -------------------------------- |
| `rendering/counter` | `react-rendering` |
| `reconciliation/wrapper` | `react-reconciliation` |
| `keys/list` | `react-keys` |
| `closure/stale-interval` | `react-closure` |
| `hooks/order` | `react-hooks` |

## LabFixtureAllowlist (derived)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `labSlug` | string | Lab identity |
| `fixtureIds` | `Set<string>` | Distinct `payload.reactScenario.scenarioId` from that lab’s guided steps |

**Rule**: Request `fixtureId` ∈ allowlist for `labSlug`, else `NOT_ALLOWED`.

## ReactSandboxPolicy

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `timeoutMs` | number | 5000 | Per-run hard timeout |
| `maxInteractions` | number | 50 | Pre-flight cap |
| `maxItems` | number | 500 | Cap on list-like prop complexity |
| `policyVersion` | string | `react-sandbox-v1` | Echoed on policy errors |

## ProfilerObservation (internal)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `renderCount` | number | Observed render passes |
| `commitDurationsMs` | number[] | Profiler `actualDuration` samples |
| `treeDepth` | number | Max component tree depth |
| `nodesReused` | number | Reconcile reuse count |
| `nodesRemounted` | number | Remount count |
| `hostMutations` | number | Host-tree create/update/delete ops → `dom_mutations` |
| `memoHitRate` | number \| null | Percent when measurable |
| `effectRunCount` | number \| null | Effects fired |
| `capturedValue` | number \| null | Closure capture teaching signal |
| `staleReads` | number \| null | Stale closure reads |

## ReactExperimentResult (success)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `adapterType` | `headless_react_sandbox` | Runtime adapter type |
| `metrics` | `MetricContract[]` | Subset of `react-metrics` catalog |
| `raw` | `ReactExperimentRaw` | Action, fixture id, interaction count, educational notes |

## Error categories (DomainError)

| Category | When |
| -------- | ---- |
| `VALIDATION_ERROR` | Malformed body, empty action, `componentSource` present, over caps |
| `NOT_ALLOWED` / policy | Fixture not allowlisted for lab |
| `NOT_FOUND` | Unknown fixture id |
| `UNSUPPORTED` | Action not supported for fixture |
| `TIMEOUT` | Exceeded `timeoutMs` |
| `EXECUTION_ERROR` | Fixture throw / runtime fault |
| `UNAUTHORIZED` | Missing/invalid JWT |

## Lifecycle

```text
HTTP POST /experiments/react/run
  → auth gate
  → validate DTO (reject componentSource; enforce caps)
  → resolve lab allowlist from guided steps
  → ensure fixtureId allowlisted + registered
  → Promise.race(adapter.run, timeout)
       → fixture factory + react-test-renderer + Profiler
       → map ProfilerObservation → MetricContract[]
  → return RuntimeExperimentResult
```

No durable React tree between requests. Metrics history (if any) remains Metrics Pipeline’s concern.
