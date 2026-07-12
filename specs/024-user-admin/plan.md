# Implementation Plan: User Admin

**Branch**: `024-user-admin` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-user-admin/spec.md`

## Summary

Add admin APIs to list/search/get Platform users and update roles (`user` ↔ `admin`) under `/api/v1/admin/users`, reusing Admin AuthZ. Persist `updated_by` on role changes, enforce a race-safe last-admin guardrail, leave sessions/tokens untouched on demotion, and never expose credential secrets. Soft-disable/ban/delete remain out of scope.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM (platform connection), existing `JwtAuthGuard` / `RolesGuard` / `Role` enum, class-validator, Jest + Supertest

**Storage**: Platform DB `users` table — add nullable `updated_by` (uuid FK → users). No playground writes.

**Testing**: Unit tests for list/get/update-role use cases (pagination, search, no-op, last-admin, secrets omission); integration tests for admin user endpoints (admin allow, user 403, unauth 401, last-admin conflict)

**Target Platform**: NestJS API service (backend-only)

**Project Type**: Web-service API (NestJS monorepo backend)

**Performance Goals**: List/search p95 ≤ 200ms for typical admin pages (≤100 rows); role update p95 ≤ 100ms including transactional last-admin check

**Constraints**: No token revocation on role change; same-role no-op does not stamp metadata; never return password hashes/refresh tokens; serialize demotion so zero admins is impossible; FE UI out of scope

**Scale/Scope**: One admin users controller + use cases; extend `UserRepository`; one migration for `updated_by`; shared admin user view types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: `AdminUserView`, list/update request types in `src/shared/`; no duplicated DTOs
- [x] **Feature-first backend**: `AdminUsersController` → UseCases → `UserRepository`; AuthModule exports repository
- [x] **TypeScript strict**: No unjustified `any`
- [x] **Testing**: Unit + integration tests planned; AuthZ + last-admin covered
- [x] **Learning UX**: Actionable conflict/validation errors for last-admin and bad role; no secret leakage
- [x] **Platform vs Playground**: Users/roles on Platform DB only; playground untouched
- [x] **Simplicity**: Extend existing user entity/repo and admin module; no new identity system or audit table

**Post-design re-check**: Pass — one column migration, admin controller slice, transactional last-admin check; no unjustified abstractions.

## Project Structure

### Documentation (this feature)

```text
specs/024-user-admin/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/user-admin-api.md
└── tasks.md                 # /speckit-tasks (not created by plan)
```

### Source Code (repository root)

```text
src/shared/
├── auth/ or users/          # AdminUserView, UpdateAdminUserRoleRequest, list query types
└── index.ts                 # re-exports

src/modules/auth/
├── entities/user.entity.ts  # add updatedBy nullable
└── infrastructure/user.repository.ts  # list/search, countAdmins, updateRoleAtomic

src/modules/admin/
├── admin.module.ts          # register users controller + use cases
├── admin-users.controller.ts
├── dto/                     # list query + update role DTOs
├── mappers/admin-user.mapper.ts
└── application/
    ├── list-admin-users.usecase.ts
    ├── get-admin-user.usecase.ts
    └── update-admin-user-role.usecase.ts

src/database/migrations/
└── 1731000000000-AddUserUpdatedBy.ts

test/integration/user-admin.integration-spec.ts
```

**Structure Decision**: Extend the existing `admin` module (same pattern as tracks/labs/quiz admin). User persistence stays in `auth` module repositories; admin only orchestrates. Do not add user-management routes on `AuthController`.

## Complexity Tracking

No constitution violations requiring justification.
