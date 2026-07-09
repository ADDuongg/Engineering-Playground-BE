# Tasks: Authentication

**Input**: Design documents from `/specs/009-authentication/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks grouped by user story. Existing backend code satisfies most implementation tasks — focus on tests and contract alignment.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify shared contracts and module registration

- [x] T001 [P] Verify `UserProfile`, `AuthTokens`, `AuthResponse`, `Role` exported from `src/shared/auth/` and `src/shared/index.ts`
- [x] T002 Verify `AuthModule` registered in `src/app.module.ts` with global `JwtAuthGuard`
- [x] T003 Verify Platform DB migration `src/database/migrations/1730000000000-InitAuthTables.ts` for users and refresh_tokens

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core auth flows — already implemented; validate completeness

- [x] T004 Implement register/login/refresh/logout/get-me use cases in `src/modules/auth/application/`
- [x] T005 Implement `TokenService` with refresh rotation in `src/modules/auth/application/token.service.ts`
- [x] T006 Implement `AuthController` with rate limits and `@Public()` markers in `src/modules/auth/auth.controller.ts`
- [x] T007 [P] Unit tests for register and login in `*.usecase.spec.ts`

**Checkpoint**: Core flows callable programmatically

---

## Phase 3: User Story 1 — Create an Account (P1) 🎯 MVP

**Goal**: Register with validation and conflict handling

**Independent Test**: Valid register → 201 with user and tokens; duplicate email → 409

### Tests for User Story 1

- [x] T008 [P] [US1] Integration test register success and duplicate email in `test/integration/auth.integration-spec.ts`

### Implementation for User Story 1

- [x] T009 [US1] Email normalization on register in `register.usecase.ts`

**Checkpoint**: User Story 1 independently testable

---

## Phase 4: User Story 2 — Sign In (P1)

**Goal**: Login with generic failure message

**Independent Test**: Valid login → 200; wrong password → 401 with same message as unknown email

### Tests for User Story 2

- [x] T010 [P] [US2] Integration test login success and invalid credentials in `test/integration/auth.integration-spec.ts`
- [x] T011 [P] [US2] Unit test login email normalization in `login.usecase.spec.ts`

### Implementation for User Story 2

- [x] T012 [US2] Normalize email to lowercase in `login.usecase.ts` before lookup

**Checkpoint**: User Stories 1 and 2 complete

---

## Phase 5: User Story 3 — Session Renewal (P1)

**Goal**: Refresh rotates tokens; expired/revoked tokens rejected

**Independent Test**: Refresh → new pair; old refresh fails on second use

### Tests for User Story 3

- [x] T013 [P] [US3] Unit tests for `RefreshTokenUseCase` in `refresh-token.usecase.spec.ts`
- [x] T014 [P] [US3] Unit tests for `TokenService` rotation in `token.service.spec.ts`
- [x] T015 [P] [US3] Integration test refresh and revoked token in `test/integration/auth.integration-spec.ts`

**Checkpoint**: User Story 3 complete

---

## Phase 6: User Story 4 — View Profile (P2)

**Goal**: GET /me returns profile for authenticated user

**Independent Test**: Bearer token → 200 profile; no token → 401

### Tests for User Story 4

- [x] T016 [P] [US4] Unit tests for `GetMeUseCase` in `get-me.usecase.spec.ts`
- [x] T017 [P] [US4] Integration test /me authorized and unauthorized in `test/integration/auth.integration-spec.ts`

**Checkpoint**: User Story 4 complete

---

## Phase 7: User Story 5 — Sign Out (P2)

**Goal**: Logout revokes refresh token; idempotent

**Independent Test**: Logout → 204; subsequent refresh with same token → 401

### Tests for User Story 5

- [x] T018 [P] [US5] Unit tests for `LogoutUseCase` in `logout.usecase.spec.ts`
- [x] T019 [P] [US5] Integration test logout and post-logout refresh failure in `test/integration/auth.integration-spec.ts`

**Checkpoint**: All user stories complete

---

## Phase 8: Polish & Cross-Cutting

- [x] T020 [P] Expand mocked HTTP e2e coverage in `test/auth.e2e-spec.ts` (refresh, me, logout, validation)
- [x] T021 Update BACKLOG Authentication status and checklist in `docs/product/BACKLOG.md`
- [x] T022 Run full auth test suite and verify quickstart commands

---

## Dependencies

```text
Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3)
                                              ↘
                                    Phase 6 (US4) + Phase 7 (US5)
All → Phase 8
```

## Implementation Strategy

**MVP first**: Phases 1–4 (register + login) with integration tests.

**Incremental**: Add refresh (US3), profile (US4), logout (US5), then polish.
