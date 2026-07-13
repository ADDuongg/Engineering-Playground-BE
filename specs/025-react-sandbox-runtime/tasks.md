# Tasks: React Sandbox Runtime

**Input**: Design documents from `/specs/025-react-sandbox-runtime/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other `[P]` tasks in the same phase
- **[USn]**: Maps to User Story n in spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, config, and shared contract tightening

- [x] T001 Add `react` and `react-test-renderer` (plus `@types/react` / `@types/react-test-renderer` as needed) to package dependencies
- [x] T002 [P] Add `reactSandbox.*` config keys and env validation in `src/config/configuration.ts` and `src/config/env.validation.ts`
- [x] T003 [P] Tighten `src/shared/runtime/react-experiment.ts` request shape (`fixtureId` / lab context) and export any new types via `src/shared/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Policy, fixture registry skeleton, and allowlist service — MUST complete before real profiler work

- [x] T004 Implement `ReactSandboxPolicy` defaults/loader in `src/modules/runtime-adapter/domain/react-sandbox-policy.ts` and `config/react-sandbox.config.ts`
- [x] T005 [P] Implement `ReactFixture` types + empty `ReactFixtureRegistry` in `domain/react-fixture.ts` and `infrastructure/react-fixture.registry.ts`
- [x] T006 [P] Implement `LabReactFixtureAllowlistService` (derive fixture ids from lab guided steps) in `application/lab-react-fixture-allowlist.service.ts`
- [x] T007 Unit tests for allowlist derive/reject and unknown fixture in `application/lab-react-fixture-allowlist.service.spec.ts`
- [x] T008 Scaffold `RunReactExperimentUseCase` (validate → allowlist → caps → dispatch `RunExperimentUseCase`) without real profiler yet in `application/run-react-experiment.usecase.ts`

**Checkpoint**: Orchestration callable; fixtures registry resolvable; allowlist enforced in unit tests

---

## Phase 3: User Story 1 — Learner Runs Scenario and Sees Metrics (P1) 🎯 MVP

**Goal**: Real headless execution for Rendering fixture returns `react-metrics`

**Independent Test**: Auth + `rendering/counter` + state update → `render_count`, `commit_duration_ms`, `component_tree_depth`

### Tests for User Story 1

- [x] T009 [P] [US1] Unit tests for profiler metric mapping (structural asserts + tolerant timing) in `domain/react-profiler-metrics.spec.ts`
- [x] T010 [P] [US1] Adapter unit tests for `rendering/counter` interactions in `infrastructure/react-runtime.adapter.spec.ts`

### Implementation for User Story 1

- [x] T011 [US1] Implement `rendering-counter.fixture.tsx` and register id `rendering/counter` in fixture registry
- [x] T012 [US1] Implement headless runner + Profiler observation → MetricContract mapper in `domain/react-profiler-metrics.ts` and wire `ReactRuntimeAdapter` to use it (remove production `deriveReactMetrics` path)
- [x] T013 [US1] Add `RunReactExperimentDto` + `POST /experiments/react/run` (JWT required) in `dto/run-react-experiment.dto.ts` and `react-experiment.controller.ts`; register in module
- [x] T014 [US1] Integration smoke: authenticated render run success in `test/integration/react-sandbox-runtime.integration-spec.ts`

**Checkpoint**: User Story 1 independently testable via HTTP

---

## Phase 4: User Story 2 — Track-Agnostic Adapter Resolution (P1)

**Goal**: Registry resolves `headless_react_sandbox`; non-React tracks unaffected

**Independent Test**: Resolve React adapter by type; PostgreSQL adapter still works in existing tests

### Tests for User Story 2

- [x] T015 [P] [US2] Registry/use-case tests ensure React dispatch by adapter type in `application/run-experiment.usecase.spec.ts` / registry spec

### Implementation for User Story 2

- [x] T016 [US2] Confirm module provider registration for `ReactRuntimeAdapter` + document trackSlug default `frontend-react` in `RunReactExperimentUseCase`
- [x] T017 [US2] Guard unknown adapter / missing fixture registry miss → clear `NOT_FOUND` / unsupported errors

**Checkpoint**: US1 + US2 green; SQL experiment tests still pass

---

## Phase 5: User Story 3 — Timeouts and Resource Limits (P1)

**Goal**: Caps and timeout produce categorized errors without success metrics

**Independent Test**: Over-cap interactions rejected; short timeout → `TIMEOUT`

### Tests for User Story 3

- [x] T018 [P] [US3] Unit tests for interaction/item caps and timeout race in `run-react-experiment.usecase.spec.ts`

### Implementation for User Story 3

- [x] T019 [US3] Enforce pre-flight caps and `Promise.race` timeout in `RunReactExperimentUseCase`; map to DomainError categories
- [x] T020 [US3] Integration cases for timeout and over-cap in `react-sandbox-runtime.integration-spec.ts`

**Checkpoint**: Limit failures never return success metrics

---

## Phase 6: User Story 4 — Scenario Inputs Drive Metrics (P1)

**Goal**: Remaining fixtures + options toggles change metrics in expected directions

**Independent Test**: memo on/off; keyStrategy index vs stable; hooks/closure metrics present

### Tests for User Story 4

- [x] T021 [P] [US4] Comparison unit tests for memo and keyStrategy directions in `react-runtime.adapter.spec.ts`
- [x] T022 [P] [US4] Fixture tests for reconciliation/keys/closure/hooks measurement sets

### Implementation for User Story 4

- [x] T023 [US4] Implement remaining fixtures: `reconciliation-wrapper`, `keys-list`, `closure-stale-interval`, `hooks-order` under `infrastructure/fixtures/`
- [x] T024 [US4] Ensure action-specific metric omission (FR-012) and options application in adapter/fixtures
- [x] T025 [US4] Extend integration coverage for at least one non-rendering lab fixture allowlisted correctly

**Checkpoint**: All five seeded fixture ids executable under allowlist

---

## Phase 7: User Story 5 — Actionable Errors (P2)

**Goal**: Distinct categories for validation, not-allowed, unsupported, runtime, unauthenticated

**Independent Test**: Fixture matrix of error categories with educational hints

### Tests for User Story 5

- [x] T026 [P] [US5] Unit/integration matrix: `componentSource` rejected, cross-lab `NOT_ALLOWED`, unsupported action, unauthenticated 401

### Implementation for User Story 5

- [x] T027 [US5] Finalize DomainError mapping + learner hints in `RunReactExperimentUseCase` / controller filter path
- [x] T028 [US5] Structured audit log `experiment_react_run` (start/success/fail) without large props/source payloads

**Checkpoint**: Error taxonomy complete per contract

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: Docs, cleanup, acceptance mapping

- [x] T029 [P] Remove or quarantine unused `deriveReactMetrics` production import; keep only if explicitly test-double
- [x] T030 [P] Update quickstart verification notes if paths/env names drifted
- [x] T031 Run full targeted suites: `pnpm test -- react-runtime` / `run-react-experiment` and `pnpm test:e2e -- react-sandbox-runtime`
- [x] T032 Mark backlog checklist items (Implemented/Tested) only after suites green; leave Documented until quickstart exercised

---

## Dependencies

```text
Phase 1 → Phase 2 → Phase 3 (US1 MVP) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5) → Phase 8
```

- US1 blocks meaningful HTTP demo
- US4 depends on US1 profiler pipeline
- US3 can partially overlap US1 but timeout wiring should follow adapter existence
- US5 finalizes error polish after happy paths exist

## Parallel examples

- After T004: T005 ∥ T006
- After T012: T009 ∥ T010 (if not written first; prefer tests-first where practical)
- Phase 6: T021 ∥ T022; T023 fixtures can be split by file across agents

## Implementation strategy

1. Complete Phase 1–2 foundation
2. Ship US1 MVP (rendering fixture + HTTP + real profiler)
3. Layer US2–US5 incrementally without breaking SQL tracks
4. Polish and backlog update last

## MVP scope (first shippable slice)

T001–T014 (Setup + Foundation + User Story 1)
