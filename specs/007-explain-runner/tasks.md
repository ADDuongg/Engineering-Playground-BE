# Tasks: Explain Runner

**Input**: Design documents from `/specs/007-explain-runner/`

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Add explain shared types in `src/shared/explain/` and export from `src/shared/index.ts`
- [x] T002 [P] Scaffold `ExplainRunnerModule` in `src/modules/explain-runner/explain-runner.module.ts`
- [x] T003 Register `ExplainRunnerModule` in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T004 Implement `ExplainPlanParser` and `buildExplainSql` in `src/modules/explain-runner/infrastructure/explain-plan.parser.ts`
- [x] T005 [P] Unit tests for plan parser in `explain-plan.parser.spec.ts`
- [x] T006 Implement `RunExplainUseCase` with readiness gate and sandbox delegation in `run-explain.usecase.ts`
- [x] T007 [P] Unit tests for explain use case in `run-explain.usecase.spec.ts`

---

## Phase 3: User Story 1 — Learner Inspects Query Plan (P1) 🎯 MVP

- [x] T008 [P] [US1] Integration test EXPLAIN structured plan in `test/integration/explain-runner.integration-spec.ts`
- [x] T009 [US1] Add `RunExplainDto` and `POST /experiments/sql/explain` in controller

---

## Phase 4: User Story 2 — Actionable Explain Errors (P1)

- [x] T010 [P] [US2] Integration tests for not-ready, sandbox violation, EXPLAIN prefix rejection

---

## Phase 5: User Story 3 — Playground Isolation (P1)

- [x] T011 [P] [US3] Integration assertion platform DB unchanged in `explain-runner.integration-spec.ts`

---

## Phase 6: User Story 4 — Structured Plan Output (P1)

- [x] T012 [US4] Parser maps PG JSON to `ExplainPlanNode` tree with costs and row fields

---

## Phase 7: User Story 5 — Lab Context and Session Scope (P2)

- [x] T013 [US5] Forward sessionId and lab context through use case to sandbox (mirrors experiment runner)

---

## Phase 8: User Story 6 — Audit Logging (P2)

- [x] T014 [US6] Structured `explain_sql_run` audit events in `run-explain.usecase.ts`

---

## Phase 9: Polish & Cross-Cutting Concerns

- [x] T015 [P] Swagger decorators on `ExplainRunnerController`
- [x] T016 Update `specs/007-explain-runner/spec.md` status when verified
- [x] T017 Update `docs/product/BACKLOG.md` Explain Runner status and checklist

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phases 3–8 → Phase 9
- MVP: Phases 1–6 deliver core explain path with structured plans
