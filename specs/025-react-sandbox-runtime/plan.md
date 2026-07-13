# Implementation Plan: React Sandbox Runtime

**Branch**: `025-react-sandbox-runtime` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-react-sandbox-runtime/spec.md`

## Summary

Replace the deterministic placeholder in `ReactRuntimeAdapter` with a real headless React profiler that executes **built-in fixture IDs** (seeded scenario ids such as `rendering/counter`), applies learner props/interactions/options, and emits `react-metrics` Metric Contract values from observed render/reconcile/hook behavior. Expose `POST /api/v1/experiments/react/run` (auth required) that validates lab-scoped fixture allowlisting, enforces timeout/resource caps, and dispatches via existing `RunExperimentUseCase` + Runtime Adapter registry. No Playground PostgreSQL dependency; no `componentSource` execution in MVP.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, React 19 + `react-test-renderer` (Profiler / host-tree instrumentation), Jest, class-validator — extends existing `RuntimeAdapterModule`

**Storage**: No new Platform DB tables. Fixture implementations are code-registered. Lab allowlist derived from Platform DB guided-step `reactScenario.scenarioId` values (existing Lab Flow tables). Optional Metrics Pipeline persistence reuse only if already wired for experiment responses.

**Testing**: Jest unit tests (fixture registry, profiler metrics, allowlist gate, timeout); integration/e2e for authenticated HTTP run matrix (success, cross-lab reject, unknown fixture, timeout)

**Target Platform**: NestJS backend — `src/modules/runtime-adapter/` (+ thin HTTP controller under experiments namespace)

**Project Type**: Web service module (Runtime Adapter + learner-facing experiment endpoint)

**Performance Goals**: p95 &lt; 2s for typical seeded fixtures with ≤10 interactions (SC-011); hard per-run timeout default 5s

**Constraints**: Built-in fixtures only; lab-scoped allowlist; auth required; real measured `commit_duration_ms`; `dom_mutations` = observed host-tree/fiber mutations; never touch Playground PostgreSQL; reject `componentSource`

**Scale/Scope**: Frontend React Track MVP fixtures already seeded (`rendering/counter`, `reconciliation/wrapper`, `keys/list`, `closure/stale-interval`, `hooks/order`); synchronous in-request execution

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Reference: `.specify/memory/constitution.md` (Engineering Playground v1.1.0)

- [x] **Contracts**: Extend `src/shared/runtime/` request/response DTOs; export via `@db-play/types`; no duplicated FE DTOs
- [x] **Feature-first backend**: Controller → UseCase (`RunReactExperimentUseCase` orchestration) → Runtime Adapter; registry already isolates infrastructure
- [x] **TypeScript strict**: Typed fixtures, profiler observations, DomainError mapping; no unjustified `any`
- [x] **Testing**: Unit + integration planned; critical auth/allowlist/success journeys covered
- [x] **Learning UX**: Track-aware DomainError categories; metrics backend-only (`react-metrics`)
- [x] **Platform vs Playground**: No playground PG; disposable per-request headless trees; Platform DB read-only for lab allowlist lookup
- [x] **Simplicity**: Extend existing `runtime-adapter` module; no worker queue; no new Track Registry schema

**Post-design note**: HTTP lives beside SQL experiment routes for discoverability; React-specific validation/allowlist stays in a dedicated use case that then calls track-agnostic `RunExperimentUseCase`. Placeholder `deriveReactMetrics` is removed from the production adapter path (may remain as test double only if needed during migration).

## Project Structure

### Documentation (this feature)

```text
specs/025-react-sandbox-runtime/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── react-sandbox-runtime-service.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
src/
├── modules/
│   └── runtime-adapter/
│       ├── runtime-adapter.module.ts
│       ├── react-experiment.controller.ts          # POST experiments/react/run
│       ├── dto/
│       │   └── run-react-experiment.dto.ts
│       ├── application/
│       │   ├── run-experiment.usecase.ts           # existing (unchanged contract)
│       │   ├── run-react-experiment.usecase.ts     # auth context + allowlist + limits
│       │   ├── run-react-experiment.usecase.spec.ts
│       │   └── lab-react-fixture-allowlist.service.ts
│       ├── domain/
│       │   ├── runtime-adapter.ts                  # existing
│       │   ├── react-fixture.ts                    # fixture id + factory types
│       │   ├── react-sandbox-policy.ts             # timeout / caps
│       │   └── react-profiler-metrics.ts           # map observations → MetricContract
│       ├── infrastructure/
│       │   ├── react-runtime.adapter.ts            # real headless execution
│       │   ├── react-runtime.adapter.spec.ts
│       │   ├── react-fixture.registry.ts           # built-in fixtures map
│       │   └── fixtures/
│       │       ├── rendering-counter.fixture.tsx
│       │       ├── reconciliation-wrapper.fixture.tsx
│       │       ├── keys-list.fixture.tsx
│       │       ├── closure-stale-interval.fixture.tsx
│       │       └── hooks-order.fixture.tsx
│       └── config/
│           └── react-sandbox.config.ts
├── shared/
│   └── runtime/
│       ├── react-experiment.ts                     # tighten input (fixtureId required)
│       └── runtime-experiment.ts                   # existing
└── config/
    ├── configuration.ts                            # reactSandbox.* keys
    └── env.validation.ts

test/
└── integration/
    └── react-sandbox-runtime.integration-spec.ts
```

**Structure Decision**: Keep work inside `runtime-adapter` (already owns registry + React adapter). Add a thin React experiment controller/use case for HTTP validation, lab allowlist, and policy — mirroring how SQL has `experiment-runner` but avoiding a second parallel module since the React adapter already lives here and there is no dataset/sandbox split.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| React HTTP controller inside `runtime-adapter` (not a new `experiment-runner-react` module) | Adapter + fixtures already colocated; React has no dataset/sandbox sibling modules | New module would duplicate registry wiring and split one Track's runtime across two folders without benefit |
| Platform DB read for allowlist | Spec requires lab-scoped fixture IDs | Trusting client-supplied fixture without lab check fails FR-005 / SC-010 |
| Add `react` + `react-test-renderer` dependencies | Spec requires real headless execution | Keeping formula placeholder fails FR-004 Done criteria |
