# API Contract: React Sandbox Runtime

**Feature**: 025-react-sandbox-runtime | **Module**: `RuntimeAdapterModule` | **Base path**: `/experiments`

All responses use the standard API envelope: `{ success, data, meta, error }`.

Authentication: **JWT required** (Bearer). Unlike `POST /experiments/sql/run`, this endpoint is **not** public.

---

## POST /experiments/react/run

**Purpose**: Execute a Frontend React Track experiment against a built-in headless fixture allowlisted for the given lab. Returns backend-owned `react-metrics` Metric Contract entries.

### Request body: `RunReactExperimentDto`

```typescript
interface RunReactExperimentDto {
  action: string;
  fixtureId: string; // e.g. "rendering/counter"
  labSlug: string;   // required for allowlist
  trackSlug?: string; // default "frontend-react"
  props?: Record<string, unknown>;
  interactions?: Array<{ type: string; payload?: unknown }>;
  options?: {
    memo?: boolean;
    keyStrategy?: 'index' | 'stable';
  };
  // componentSource MUST NOT be sent; if present → 400 VALIDATION_ERROR
}
```

### Response (success): `200 OK`

```typescript
interface ReactExperimentRunResult {
  adapterType: 'headless_react_sandbox';
  metrics: MetricContract[]; // keys ⊆ react-metrics catalog
  raw: {
    action: string;
    scenarioId: string; // echo fixtureId
    interactionCount: number;
    notes: string[];
  };
  runId?: string; // if Metrics Pipeline persistence is attached
}
```

`MetricContract`:

```typescript
interface MetricContract {
  key: string;
  label: string;
  unit: string;
  value: number;
  group: string;
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `VALIDATION_ERROR` | 400 | Invalid body, empty `fixtureId`/`labSlug`/`action`, `componentSource` present, interaction/item caps exceeded |
| `NOT_FOUND` | 404 | Unknown `fixtureId` (not in fixture registry) |
| `FORBIDDEN` / `SANDBOX_ERROR` | 403 | Fixture not allowlisted for `labSlug` (`NOT_ALLOWED`) |
| `TIMEOUT` | 408 | Run exceeded configured timeout |
| `EXECUTION_ERROR` | 422 | Unsupported action, fixture throw, or runtime fault |

#### Not allowlisted example (`details`)

```typescript
{
  reason: 'FIXTURE_NOT_ALLOWED_FOR_LAB',
  labSlug: 'react-rendering',
  fixtureId: 'keys/list',
  hint: 'This fixture belongs to another lab. Use a scenario from this lab’s guided steps.'
}
```

#### Timeout example

```typescript
{
  reason: 'REACT_SANDBOX_TIMEOUT',
  timeoutMs: 5000,
  hint: 'Simplify interactions or component work and try again.'
}
```

---

## Internal module exports

| Export | Purpose |
| ------ | ------- |
| `RunReactExperimentUseCase` | HTTP/programmatic React experiment orchestration |
| `RunExperimentUseCase` | Existing track-agnostic adapter dispatch (unchanged) |
| `ReactRuntimeAdapter` | Headless React Runtime Adapter (`headless_react_sandbox`) |
| `ReactFixtureRegistry` | Built-in fixture id → factory map |
| `RuntimeAdapterModule` | NestJS module registration |

---

## Metric catalog (emitted subset)

Applicable keys from `react-metrics` (omit when not measurable for the action):

| key | group | Notes |
| --- | ----- | ----- |
| `render_count` | render | Observed render passes |
| `commit_duration_ms` | render | Real Profiler timing (sum/primary commit) |
| `component_tree_depth` | render | Max depth |
| `nodes_reused` | reconciliation | |
| `nodes_remounted` | reconciliation | |
| `dom_mutations` | reconciliation | Host-tree / fiber mutations |
| `remount_count` | reconciliation | |
| `memo_hit_rate` | memoization | Percent |
| `effect_run_count` | hooks | |
| `captured_value` | hooks | |
| `stale_reads` | hooks | |

Frontend MUST NOT recompute these values.

---

## Config

| Env / config key | Default | Description |
| ---------------- | ------- | ----------- |
| `REACT_SANDBOX_TIMEOUT_MS` | `5000` | Hard per-run timeout |
| `REACT_SANDBOX_MAX_INTERACTIONS` | `50` | Pre-flight cap |
| `REACT_SANDBOX_MAX_ITEMS` | `500` | List/item complexity cap |

---

## Non-goals (this contract)

- SQL experiment routes unchanged
- No admin CRUD for fixtures (code-registered)
- No FE visualization contracts beyond Metric Contract consumption
