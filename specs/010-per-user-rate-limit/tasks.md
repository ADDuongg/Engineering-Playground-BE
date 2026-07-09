# Tasks: Per-User Rate Limit

**Input**: Design documents from `/specs/010-per-user-rate-limit/`

## Phase 1: Setup

- [x] T001 [P] Add shared rate-limit types in `src/shared/rate-limit/` and export from `src/shared/index.ts`
- [x] T002 Add rate limit config to `src/config/configuration.ts` and `src/config/env.validation.ts`
- [x] T003 Create `src/modules/rate-limit/rate-limit.module.ts` and register in `src/app.module.ts`

## Phase 2: Foundational

- [x] T004 Implement `RateLimitService` in `src/modules/rate-limit/application/rate-limit.service.ts`
- [x] T005 [P] Unit tests in `src/modules/rate-limit/application/rate-limit.service.spec.ts`

## Phase 3: User Story 1 — Fair per-user limits (P1)

- [x] T006 [US1] Integrate consume in `src/modules/experiment-runner/application/run-experiment-sql.usecase.ts` after validation
- [x] T007 [P] [US1] Integration test SQL limit isolation in `test/integration/rate-limit.integration-spec.ts`

## Phase 4: User Story 2 — Operation tiers (P1)

- [x] T008 [US2] Integrate consume in `src/modules/explain-runner/application/run-explain.usecase.ts`
- [x] T009 [US2] Integrate consume in `src/modules/dataset-loader/application/reset-dataset.usecase.ts`
- [x] T010 [US2] Pass userId from `src/modules/dataset-loader/dataset-loader.controller.ts`

## Phase 5: User Story 3 — Actionable errors (P1)

- [x] T011 [US3] Ensure `RateLimitService` throws `DomainError` with operation label and retryAfterSeconds

## Phase 6: User Story 4 — Session fallback (P2)

- [x] T012 [US4] Session-scoped limits covered by identity resolution in `rate-limit.service.ts`

## Phase 7: Polish

- [x] T013 Update backlog status and run full test suite
