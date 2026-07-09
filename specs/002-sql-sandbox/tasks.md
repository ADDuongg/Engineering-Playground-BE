# Tasks: SQL Sandbox & Resource Limits

**Input**: Design documents from `/specs/002-sql-sandbox/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story for independent validation.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies, shared types, module scaffold

- [x] T001 Add `pgsql-ast-parser` dependency in `package.json`
- [x] T002 [P] Add shared sandbox types and enums in `src/shared/sandbox/` and export from `src/shared/index.ts`
- [x] T003 [P] Add sandbox config keys to `src/config/configuration.ts` and `src/config/env.validation.ts`
- [x] T004 Create `src/modules/sql-sandbox/sql-sandbox.module.ts` scaffold and register in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core validation and classification — MUST complete before execution stories

- [x] T005 [P] Implement blocked statement patterns in `src/modules/sql-sandbox/domain/blocked-statement.rules.ts`
- [x] T006 [P] Implement statement classifier in `src/modules/sql-sandbox/domain/statement-classifier.ts`
- [x] T007 [P] Unit tests for classifier and blocked rules in `src/modules/sql-sandbox/domain/statement-classifier.spec.ts`
- [x] T008 Implement `ValidateSqlStatementService` in `src/modules/sql-sandbox/application/validate-sql-statement.service.ts`
- [x] T009 [P] Unit tests for validator in `src/modules/sql-sandbox/application/validate-sql-statement.service.spec.ts`

**Checkpoint**: Validation layer ready — execution can be built

---

## Phase 3: User Story 1 — Safe SQL Execution Within Sandbox (P1) 🎯 MVP

**Goal**: Allowed parameterized statements execute; dangerous/disallowed statements blocked with educational errors

**Independent Test**: Unit + integration tests prove SELECT passes, DROP DATABASE and COPY PROGRAM fail pre-execution

### Tests for User Story 1

- [x] T010 [P] [US1] Unit tests for allowed/blocked fixtures in `execute-sandboxed-sql.usecase.spec.ts`
- [x] T011 [P] [US1] Integration tests for allow/block scenarios in `test/integration/sql-sandbox.integration-spec.ts`

### Implementation for User Story 1

- [x] T012 [US1] Implement `ExecuteSandboxedSqlUseCase` in `src/modules/sql-sandbox/application/execute-sandboxed-sql.usecase.ts`
- [x] T013 [US1] Wire validation → playground query execution via `PlaygroundDatabaseService`
- [x] T014 [US1] Map sandbox violations to `DomainError` with `SANDBOX_ERROR` and educational hints
- [x] T015 [US1] Export `ExecuteSandboxedSqlUseCase` from `SqlSandboxModule` for downstream runners

**Checkpoint**: User Story 1 independently testable

---

## Phase 4: User Story 2 — Resource Limits Protect Shared Playground (P1)

**Goal**: Timeout and row caps enforced with categorized errors

**Independent Test**: Slow query hits TIMEOUT; large result set truncated or limited with hint

### Tests for User Story 2

- [x] T016 [P] [US2] Unit tests for timeout and row-cap behavior in `execute-sandboxed-sql.usecase.spec.ts`
- [x] T017 [P] [US2] Integration test timeout fixture in `test/integration/sql-sandbox.integration-spec.ts`

### Implementation for User Story 2

- [x] T018 [US2] Apply `SET LOCAL statement_timeout` per execution in `execute-sandboxed-sql.usecase.ts`
- [x] T019 [US2] Enforce max row cap (rewrite LIMIT or truncate + flag) in `execute-sandboxed-sql.usecase.ts`
- [x] T020 [US2] Map timeout to `DomainError` with `TIMEOUT` and educational hint
- [x] T021 [US2] Include `executionTimeMs` and `truncated` in `SandboxExecuteResult`

**Checkpoint**: User Stories 1 and 2 complete

---

## Phase 5: User Story 3 — Downstream Runners Consume Sandbox as Shared Guard (P2)

**Goal**: Module contract stable for Experiment Runner / Explain Runner integration

**Independent Test**: Module exports documented contract; explain-style SELECT wrapped queries pass same validation

### Tests for User Story 3

- [x] T022 [P] [US3] Add EXPLAIN/EXPLAIN ANALYZE fixture tests in `validate-sql-statement.service.spec.ts`
- [x] T023 [P] [US3] Add CREATE INDEX / DROP INDEX allowlist tests in `statement-classifier.spec.ts`

### Implementation for User Story 3

- [x] T024 [US3] Extend classifier allowlist for EXPLAIN and index DDL in `statement-classifier.ts`
- [x] T025 [US3] Add `policyVersion` to violation details and logs in `execute-sandboxed-sql.usecase.ts`
- [x] T026 [US3] Document module export surface in `specs/002-sql-sandbox/contracts/sandbox-service.md` (verify sync)

**Checkpoint**: All user stories complete

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T027 [P] Add structured warn logging for violations in `execute-sandboxed-sql.usecase.ts` (requestId, violationCode; no full SQL)
- [x] T028 Run full test suite `pnpm test && pnpm test:e2e` and fix regressions
- [x] T029 Update BACKLOG.md checklist (Implemented, Tested, Documented) when complete

---

## Dependencies & Execution Order

```text
Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (Polish)
```

**User story dependencies**:
- US2 depends on US1 (execution path must exist)
- US3 depends on US1 (allowlist extensions on validation layer)

## Parallel Opportunities

- T002, T003, T005, T006, T007 can run in parallel after T001
- T010, T011 parallel once T012 scaffold exists
- T016, T017 parallel in US2 phase
- T022, T023 parallel in US3 phase

## MVP Scope

**Minimum viable delivery**: Complete through **Phase 3 (User Story 1)** — safe allow/block execution with parameterized queries. US2 (limits) is P1 and should follow immediately for production safety.

## Implementation Strategy

1. Complete Phase 1–2 first (validation foundation)
2. Deliver US1 as first demoable increment
3. Add US2 before any public Experiment Runner wiring
4. US3 polish allowlist for Explain/Index labs before Experiment Runner feature
