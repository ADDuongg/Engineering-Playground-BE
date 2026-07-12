# Tasks: User Admin

**Input**: Design documents from `/specs/024-user-admin/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included (constitution requires unit + integration; quickstart scenarios)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story label (`[US1]`…`[US5]`)
- Paths are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared contracts and admin module wiring for user management

- [x] T001 [P] Add admin user shared types (`AdminUserView`, `UpdateAdminUserRoleRequest`, `AdminUserListQuery`, pagination meta shape if missing) in `src/shared/auth/user-admin.ts` (or `src/shared/users/user-admin.ts`) and export from `src/shared/index.ts`
- [x] T002 [P] Ensure `AuthModule` exports `UserRepository` (and TypeORM `UserEntity` access) for admin use cases in `src/modules/auth/auth.module.ts`
- [x] T003 Prepare `AdminModule` import of `AuthModule` (already present) and placeholder registration notes in `src/modules/admin/admin.module.ts` for upcoming users controller/usecases

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: `updated_by` persistence + repository primitives shared by all stories

**CRITICAL**: No user story work until this phase completes

- [x] T004 Add nullable `updatedBy` column mapping on `UserEntity` in `src/modules/auth/entities/user.entity.ts` (`updated_by` uuid FK → users)
- [x] T005 Create migration `src/database/migrations/1731000000000-AddUserUpdatedBy.ts` (nullable `updated_by`, FK ON DELETE SET NULL) and register in `src/database/platform/data-source.ts` / `platform-database.module.ts` if required
- [x] T006 Extend `UserRepository` in `src/modules/auth/infrastructure/user.repository.ts` with: paginated list/search (`created_at ASC, id ASC`, optional `q` ILIKE on email/display_name, return total), `countAdmins`, and transactional `updateRoleWithLastAdminGuard` (same-role no-op; set `updated_by` only on real change; never return password hash from admin mappers)

**Checkpoint**: Schema + user write/list primitives ready

---

## Phase 3: User Story 1 — Admin Lists and Finds Users (P1) MVP

**Goal**: Admin can page/search the user directory without secrets

**Independent Test**: Admin lists users (pagination + order), searches by `q`, non-admin 403 / unauth 401; responses omit password hashes

### Tests for User Story 1

- [x] T007 [P] [US1] Unit tests for `ListAdminUsersUseCase` (pagination, search, empty page, ordering) in `src/modules/admin/application/list-admin-users.usecase.spec.ts`
- [x] T008 [P] [US1] Integration cases: admin list/search + non-admin 403 + unauth 401 in `test/integration/user-admin.integration-spec.ts`

### Implementation for User Story 1

- [x] T009 [P] [US1] Add list query DTO reusing `PaginationDto` + optional `q` in `src/modules/admin/dto/list-admin-users.query.dto.ts`
- [x] T010 [P] [US1] Add `AdminUserMapper` to map `UserEntity` → `AdminUserView` (never map `passwordHash`) in `src/modules/admin/mappers/admin-user.mapper.ts`
- [x] T011 [US1] Implement `ListAdminUsersUseCase` in `src/modules/admin/application/list-admin-users.usecase.ts`
- [x] T012 [US1] Implement `GET /admin/users` on `AdminUsersController` in `src/modules/admin/admin-users.controller.ts` with `@Roles(Role.ADMIN)` and pagination meta
- [x] T013 [US1] Register list use case + controller in `src/modules/admin/admin.module.ts` and make T007/T008 pass

**Checkpoint**: US1 list/search independently testable

---

## Phase 4: User Story 2 — Admin Promotes or Demotes Role (P1)

**Goal**: Admin can change `user` ↔ `admin` with no token revocation

**Independent Test**: Promote learner → admin (sets `updatedBy`); demote when ≥2 admins; same-role no-op leaves metadata unchanged; non-admin 403

### Tests for User Story 2

- [x] T014 [P] [US2] Unit tests for `UpdateAdminUserRoleUseCase` (promote, demote, no-op, not found, validation) in `src/modules/admin/application/update-admin-user-role.usecase.spec.ts`
- [x] T015 [P] [US2] Integration cases: promote/demote/no-op in `test/integration/user-admin.integration-spec.ts`

### Implementation for User Story 2

- [x] T016 [P] [US2] Add `UpdateAdminUserRoleDto` in `src/modules/admin/dto/update-admin-user-role.dto.ts`
- [x] T017 [US2] Implement `UpdateAdminUserRoleUseCase` in `src/modules/admin/application/update-admin-user-role.usecase.ts` (acting admin id → `updatedBy`; no refresh-token revoke)
- [x] T018 [US2] Add `PATCH /admin/users/:userId` on `AdminUsersController` in `src/modules/admin/admin-users.controller.ts`
- [x] T019 [US2] Register update use case and make T014/T015 pass

**Checkpoint**: US1 + US2 role mutation works

---

## Phase 5: User Story 3 — Last-Admin Guardrail (P1)

**Goal**: Never allow zero admins, including concurrent demotions

**Independent Test**: Sole admin demotion → 409 CONFLICT; with two admins, one demotion succeeds

### Tests for User Story 3

- [x] T020 [P] [US3] Unit tests for last-admin rejection (sole admin self/other demotion) in `src/modules/admin/application/update-admin-user-role.usecase.spec.ts`
- [x] T021 [P] [US3] Integration case: last-admin demotion returns 409 `CONFLICT` in `test/integration/user-admin.integration-spec.ts`

### Implementation for User Story 3

- [x] T022 [US3] Harden transactional last-admin check in `UserRepository` (`SELECT … FOR UPDATE` / serialized count) per `research.md` R4 in `src/modules/auth/infrastructure/user.repository.ts`
- [x] T023 [US3] Map last-admin failure to `DomainError(ErrorCode.CONFLICT, 'Cannot demote the last remaining admin.')` in `UpdateAdminUserRoleUseCase` and make T020/T021 pass

**Checkpoint**: Last-admin guardrail verified

---

## Phase 6: User Story 4 — Admin Retrieves a Single User (P2)

**Goal**: Admin get-by-id for safe profile summary

**Independent Test**: Known id → 200 `AdminUserView`; unknown → 404; non-admin → 403

### Tests for User Story 4

- [x] T024 [P] [US4] Unit tests for `GetAdminUserUseCase` in `src/modules/admin/application/get-admin-user.usecase.spec.ts`
- [x] T025 [P] [US4] Integration cases: get by id + 404 in `test/integration/user-admin.integration-spec.ts`

### Implementation for User Story 4

- [x] T026 [P] [US4] Add userId param DTO in `src/modules/admin/dto/admin-user-id.param.dto.ts`
- [x] T027 [US4] Implement `GetAdminUserUseCase` in `src/modules/admin/application/get-admin-user.usecase.ts`
- [x] T028 [US4] Add `GET /admin/users/:userId` on `AdminUsersController` and register provider; make T024/T025 pass

**Checkpoint**: Detail read works alongside list

---

## Phase 7: User Story 5 — Audit-Friendly Role Change Feedback (P2)

**Goal**: Role change responses and subsequent reads expose `updatedBy` + `updatedAt`

**Independent Test**: After promote, PATCH response and GET/list show same `updatedBy` and bumped `updatedAt`; no-op does not change them

### Tests for User Story 5

- [x] T029 [P] [US5] Unit/integration assertions that real role change stamps `updatedBy`/`updatedAt` and no-op does not in `update-admin-user-role.usecase.spec.ts` and `test/integration/user-admin.integration-spec.ts`

### Implementation for User Story 5

- [x] T030 [US5] Verify mapper + use cases always expose `updatedBy` (null until first change) on list/get/update paths; fix gaps if any in `admin-user.mapper.ts` / use cases
- [x] T031 [US5] Make T029 pass

**Checkpoint**: Audit-friendly metadata complete

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: Docs, backlog, quickstart alignment

- [x] T032 [P] Confirm quickstart steps against running API in `specs/024-user-admin/quickstart.md` (adjust only if contract drift)
- [x] T033 Update `docs/product/BACKLOG.md` User Admin status to Implementing → Done checklist items as appropriate; link PR notes when ready
- [x] T034 [P] Run targeted unit + e2e suites (`pnpm test -- user-admin` / `pnpm test:e2e -- user-admin.integration-spec`) and fix regressions

---

## Dependencies & Execution Order

```text
Phase 1 Setup
    ↓
Phase 2 Foundational (entity + migration + UserRepository)
    ↓
Phase 3 US1 List/Search (MVP)
    ↓
Phase 4 US2 Role update ──→ Phase 5 US3 Last-admin (extends US2)
    ↓
Phase 6 US4 Get-by-id (can follow US1; parallel after foundational if desired)
    ↓
Phase 7 US5 Audit metadata (validates US2/US4 fields)
    ↓
Phase 8 Polish
```

**Story completion order**: US1 → US2 → US3 → US4 → US5

**Parallel opportunities**: T001–T003; T007–T010; T014–T016; T020–T021; T024–T026; T032/T034

---

## Implementation Strategy

1. **MVP**: Complete Phase 1–3 (list/search) so operators can see users without SQL.
2. **Core value**: Add US2 + US3 (promote/demote + last-admin).
3. **Support**: Add US4 detail + US5 metadata hardening.
4. **Implement one unfinished task at a time** per feature-development workflow; mark checkboxes as done.

**Suggested MVP scope**: T001–T013 (through US1 checkpoint)
