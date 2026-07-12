# Tasks: Admin AuthZ

**Input**: Design documents from `/specs/020-admin-authz/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included (constitution requires unit + integration; contract scenarios in quickstart)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story label (`[US1]`…`[US4]`)
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold admin module and confirm shared contracts exist

- [x] T001 Verify `Role` enum (`user` | `admin`) and `UserProfile` exported from `src/shared/` / `@db-play/types`
- [x] T002 Create `src/modules/admin/` skeleton (`admin.module.ts`, empty `admin.controller.ts` placeholder) and register `AdminModule` in `src/app.module.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Harden and globally register role-based AuthZ used by all admin stories

**CRITICAL**: No user story work until this phase completes

- [x] T003 Harden `RolesGuard` in `src/common/guards/roles.guard.ts` to throw `ForbiddenException` with clear message (e.g. "Admin role required") when authenticated user lacks required role; keep allow-through when no `@Roles()` metadata
- [x] T004 Register `RolesGuard` as global `APP_GUARD` in `src/app.module.ts` (after `JwtAuthGuard` / throttler ordering preserved)
- [x] T005 [P] Expand unit tests for `RolesGuard` in `src/common/guards/roles.guard.spec.ts` (no roles metadata → allow; matching role → allow; mismatch → ForbiddenException; missing user → deny)

**Checkpoint**: Global role AuthZ ready; admin controllers can opt in with `@Roles(Role.ADMIN)`

---

## Phase 3: User Story 1 — Admin Accesses Protected Operator Surfaces (P1) MVP

**Goal**: Authenticated admin can call `GET /api/v1/admin/me` and receive identity + admin role confirmation

**Independent Test**: Promote/login as admin → `GET /admin/me` → `200` with `data.role === "admin"`

### Tests for User Story 1

- [x] T006 [P] [US1] Add failing integration cases for admin success on `GET /admin/me` in `test/integration/admin-authz.integration-spec.ts` (create file)

### Implementation for User Story 1

- [x] T007 [US1] Implement admin whoami use case reusing `GetMeUseCase` (or thin wrapper) in `src/modules/admin/application/get-admin-me.usecase.ts`
- [x] T008 [US1] Implement `AdminController` at `@Controller('admin')` with class-level `@Roles(Role.ADMIN)`, `GET me`, Swagger tags/bearer in `src/modules/admin/admin.controller.ts`
- [x] T009 [US1] Wire providers/exports in `src/modules/admin/admin.module.ts` (import `AuthModule` or provide `GetMeUseCase` / user repo as needed)
- [x] T010 [US1] Make T006 integration admin-success case pass

**Checkpoint**: US1 independently testable (admin allow path)

---

## Phase 4: User Story 2 — Non-Admin Callers Are Clearly Denied (P1)

**Goal**: Non-admin and unauthenticated callers cannot access admin whoami; structured `FORBIDDEN` / `UNAUTHORIZED`

**Independent Test**: User token → `403 FORBIDDEN`; no token → `401 UNAUTHORIZED`; no side effects

### Tests for User Story 2

- [x] T011 [P] [US2] Add integration cases for non-admin `403` and unauthenticated `401` on `GET /admin/me` in `test/integration/admin-authz.integration-spec.ts`

### Implementation for User Story 2

- [x] T012 [US2] Confirm Forbidden/Unauthorized envelope messages match contract in `specs/020-admin-authz/contracts/admin-authz-api.md` (adjust `RolesGuard` / filter mapping only if needed)
- [x] T013 [US2] Make T011 integration denial cases pass

**Checkpoint**: US1 + US2 AuthZ allow/deny complete

---

## Phase 5: User Story 3 — Learner Routes Stay Free of Admin Capabilities (P1)

**Goal**: Learner routes unchanged; no admin mutations exposed outside `/api/v1/admin/*`

**Independent Test**: Standard user still uses `GET /auth/me`; admin whoami not available via learner paths

### Tests for User Story 3

- [x] T014 [P] [US3] Add integration smoke: `user` role can `GET /auth/me` successfully while `GET /admin/me` remains `403` in `test/integration/admin-authz.integration-spec.ts`

### Implementation for User Story 3

- [x] T015 [US3] Audit learner controllers under `src/modules/` — ensure no new `@Roles(Role.ADMIN)` or admin mutations added on non-admin routes; document audit note in PR/spec checklist if clean
- [x] T016 [US3] Make T014 smoke pass

**Checkpoint**: Learner routes non-regression verified

---

## Phase 6: User Story 4 — Local/Dev Admin Promotion Documented (P2)

**Goal**: Engineers can promote a user via documented one-off Platform DB update and verify via whoami

**Independent Test**: Follow quickstart promotion → login/refresh → `GET /admin/me` succeeds in under 10 minutes

### Implementation for User Story 4

- [x] T017 [US4] Finalize promotion SQL + verification steps in `specs/020-admin-authz/quickstart.md` (align with real Platform DB connection details from `.env` / compose)
- [x] T018 [US4] Add short README pointer under Quick Start / Auth section in `README.md` linking to `specs/020-admin-authz/quickstart.md` admin promotion

**Checkpoint**: Docs satisfy FR-008 / SC-004

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: OpenAPI visibility and backlog sync

- [x] T019 [P] Ensure Swagger shows Admin tag and `GET /admin/me` secured with bearer in `src/modules/admin/admin.controller.ts`
- [x] T020 Update `docs/product/BACKLOG.md` Admin AuthZ checklist/status notes when implementation + tests complete (Spec Folder already linked)
- [x] T021 Run quickstart validation scenarios manually or via integration suite; confirm all tests green (`pnpm test -- roles.guard.spec` and `pnpm test:e2e -- admin-authz.integration-spec`)

---

## Notes

- No new migrations; role column already exists
- Do not auto-seed admin users
- Reuse `GetMeUseCase` / `UserProfile` — avoid duplicate profile contracts
- Global `RolesGuard` must not break routes without `@Roles()` metadata
- Learner audit (T015): `@Roles(Role.ADMIN)` only on `AdminController`
