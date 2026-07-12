# Implementation Plan: Admin AuthZ

**Branch**: `020-admin-authz` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-admin-authz/spec.md`

## Summary

Enforce admin-only access for the `/api/v1/admin/*` namespace using the existing `Role.ADMIN` claim on JWT access credentials. Reuse and harden the existing `Roles` decorator + `RolesGuard`, register the guard globally, ship a read-only `GET /api/v1/admin/me` whoami probe for integration tests, and document manual Platform DB role promotion (quickstart + README pointer). No new identity system, no auto-seed admin, no admin write APIs.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, Passport JWT, existing `JwtAuthGuard` / `RolesGuard` / `Role` enum, Jest + Supertest

**Storage**: Platform DB `users.role` only (no new tables/migrations). AuthZ reads role from JWT payload per request (clarified).

**Testing**: Unit tests for `RolesGuard` (allow/deny/missing roles metadata); integration tests for `GET /admin/me` (admin 200, user 403, unauthenticated 401)

**Target Platform**: NestJS API service (backend-only)

**Project Type**: Web-service API (NestJS monorepo backend)

**Performance Goals**: AuthZ check p95 ≤ 5ms overhead (in-memory role compare on request user; no DB round-trip)

**Constraints**: Credential role authoritative; structured envelope errors (`FORBIDDEN` / `UNAUTHORIZED`); no admin capabilities on learner routes; no auto-seed admin

**Scale/Scope**: One admin module + whoami probe; shared guard reused by all future Admin / Content Ops features

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared `Role`, `UserProfile` in `src/shared/`; admin whoami response reuses `UserProfile` (or thin admin confirmation DTO in shared if needed — prefer reuse)
- [x] **Feature-first backend**: `AdminController` → thin UseCase (or reuse `GetMeUseCase`) → existing user repository; guards remain cross-cutting infrastructure
- [x] **TypeScript strict**: No unjustified `any`
- [x] **Testing**: Unit + integration tests planned; critical AuthZ journeys covered
- [x] **Learning UX**: Clear forbidden message for non-admins; no stack traces or secret leakage
- [x] **Platform vs Playground**: Role lives on Platform DB users only; playground untouched
- [x] **Simplicity**: Reuse existing `Roles`/`RolesGuard`; no parallel admin auth; no new role model

**Post-design re-check**: Pass — design adds one feature module and hardens existing common guards; no unjustified abstractions.

## Project Structure

### Documentation (this feature)

```text
specs/020-admin-authz/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/admin-authz-api.md
└── tasks.md                 # /speckit-tasks (not created by plan)
```

### Source Code (repository root)

```text
src/common/
├── decorators/roles.decorator.ts          # existing — keep
├── guards/roles.guard.ts                  # harden: clear ForbiddenException message
├── guards/roles.guard.spec.ts             # expand/add unit coverage
└── guards/jwt-auth.guard.ts               # existing — runs before RolesGuard

src/modules/admin/
├── admin.module.ts
├── admin.controller.ts                    # @Controller('admin') @Roles(Role.ADMIN)
├── application/
│   └── get-admin-me.usecase.ts            # reuse GetMeUseCase or thin wrapper
└── admin.module registration in app.module.ts

src/app.module.ts                          # register RolesGuard as APP_GUARD

README.md                                  # short pointer to admin promotion
specs/020-admin-authz/quickstart.md        # full promotion + verification steps

test/integration/admin-authz.integration-spec.ts
```

**Structure Decision**: New `admin` feature module for the admin namespace surface; authorization primitives stay in `src/common` (already present). Do not put admin routes on `AuthController` to keep learner auth and operator namespace separated.

## Complexity Tracking

No constitution violations requiring justification.
