# Quickstart: React Sandbox Runtime

**Feature**: 025-react-sandbox-runtime | **Date**: 2026-07-13

Validate headless React experiment execution after implementation. Prerequisites: Platform DB migrated with Frontend React track seed, JWT auth working. **No Playground PostgreSQL required.**

See also: [contracts/react-sandbox-runtime-service.md](./contracts/react-sandbox-runtime-service.md), [data-model.md](./data-model.md).

## 1. Environment

```bash
# optional overrides
export REACT_SANDBOX_TIMEOUT_MS=5000
export REACT_SANDBOX_MAX_INTERACTIONS=50
export REACT_SANDBOX_MAX_ITEMS=500
```

Ensure `react` and `react-test-renderer` are installed as dependencies of the Nest app.

## 2. Run unit tests

```bash
pnpm test -- react-runtime
pnpm test -- run-react-experiment
```

**Expected**:
- Fixture registry resolves seeded ids
- Profiler path emits `render_count` / reconciliation metrics for fixtures
- `commit_duration_ms` is non-negative (tolerance/relative asserts only)
- Cross-lab fixture rejected before adapter run
- `componentSource` rejected with validation error
- Timeout fixture returns categorized `TIMEOUT`

## 3. Run integration tests

```bash
pnpm test:e2e -- react-sandbox-runtime
```

**Expected**:
- Authenticated `POST /experiments/react/run` for `react-rendering` + `rendering/counter` → `success` with `metrics[]`
- Same fixture with `labSlug: react-keys` → not-allowed / forbidden
- Unknown fixture → 404
- Unauthenticated → 401
- Platform / playground SQL paths unused (no PG experiment queries for this flow)

## 4. Manual smoke test (API)

Start the server (`pnpm dev`), obtain a JWT via login, then:

### Successful render run

```bash
TOKEN='<access_token>'

curl -s -X POST http://localhost:3000/api/v1/experiments/react/run \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "update_state",
    "fixtureId": "rendering/counter",
    "labSlug": "react-rendering",
    "trackSlug": "frontend-react",
    "interactions": [{ "type": "setstate", "payload": { "count": 1 } }],
    "options": { "memo": false }
  }' | jq
```

**Expected**: `success: true`, `data.adapterType: "headless_react_sandbox"`, metrics include `render_count` and `commit_duration_ms`, `raw.scenarioId: "rendering/counter"`.

### Cross-lab rejection

```bash
curl -s -X POST http://localhost:3000/api/v1/experiments/react/run \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "render_component",
    "fixtureId": "keys/list",
    "labSlug": "react-rendering"
  }' | jq
```

**Expected**: `success: false`, fixture not allowed for lab.

### Reject componentSource

```bash
curl -s -X POST http://localhost:3000/api/v1/experiments/react/run \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "render_component",
    "fixtureId": "rendering/counter",
    "labSlug": "react-rendering",
    "componentSource": "function App(){ return null }"
  }' | jq
```

**Expected**: `400` validation error; sandbox never executes the string.

## 5. Acceptance mapping

| Spec criterion | How to verify |
| -------------- | ------------- |
| SC-001 render_count | Unit fixture: mount + N updates |
| SC-002 / SC-003 option toggles | Comparison tests memo / keyStrategy |
| SC-004 timeout | Configured short timeout + slow fixture |
| SC-005 / SC-010 validation & allowlist | Integration matrix |
| SC-006 metrics catalog | Response inspection |
| SC-008 no Playground PG | Integration assertion / spy |
| SC-009 / SC-011 timing | Tolerance + optional latency sample |

## 6. Done checklist (runtime feature)

- [ ] Placeholder `deriveReactMetrics` not used on production adapter path
- [ ] Five seeded fixture ids executable
- [ ] Auth + lab allowlist enforced
- [ ] Contract + quickstart scenarios pass
