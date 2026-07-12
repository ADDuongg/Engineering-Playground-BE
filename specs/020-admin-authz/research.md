# Research: Admin AuthZ

**Feature**: `020-admin-authz` | **Date**: 2026-07-12

## R1 — Authorization source of truth

**Decision**: Trust `role` on the current JWT access credential for admin AuthZ. Do not re-query Platform DB on every admin request.

**Rationale**: Matches Authentication design (role embedded in JWT at login/refresh), clarified in spec session 2026-07-12, avoids DB load on every admin call, and demotion takes effect after refresh/re-login (already required after manual promotion).

**Alternatives considered**:

- Per-request DB role lookup — stronger immediate demotion; rejected for MVP complexity and latency
- Refresh-token revocation on demotion — belongs to future User Admin

## R2 — Reuse vs replace RolesGuard

**Decision**: Reuse existing `@Roles()` decorator and `RolesGuard`. Register `RolesGuard` as a global `APP_GUARD` (after `JwtAuthGuard`). Harden guard to throw `ForbiddenException` with a clear message when role mismatch (instead of bare `return false`), so the standard envelope maps to `ErrorCode.FORBIDDEN` with actionable text.

**Rationale**: Guard and decorator already exist and match backlog deliverables; global registration means any controller can opt in with `@Roles(Role.ADMIN)` without wiring providers per module. Empty `@Roles` metadata continues to allow (no role requirement).

**Alternatives considered**:

- Controller-only `UseGuards(RolesGuard)` without global registration — easy to forget on new admin controllers
- New `AdminOnly` guard separate from `RolesGuard` — duplicates logic
- Throw `DomainError(FORBIDDEN)` from guard — works but Nest HTTP exceptions already map correctly via `AllExceptionsFilter`

## R3 — Minimal admin surface

**Decision**: `GET /api/v1/admin/me` — read-only whoami that returns `UserProfile` (same shape as `GET /auth/me`) after admin AuthZ succeeds.

**Rationale**: Clarified as read-only whoami/session probe; reusing `UserProfile` avoids a second profile contract; path under `admin` namespace proves shared rule for future CRUD.

**Alternatives considered**:

- No HTTP probe (unit tests only) — weaker E2E confidence before Track & Lab Admin CRUD
- Write stub endpoint — unnecessary mutation surface
- Return JWT claims only without DB profile — weaker identity confirmation; prefer reuse `GetMeUseCase` for consistency with `/auth/me`

## R4 — Module placement

**Decision**: New `src/modules/admin/` with `AdminController` at `@Controller('admin')`, class-level `@Roles(Role.ADMIN)` + `@ApiBearerAuth()`.

**Rationale**: Keeps learner `auth` routes free of admin capabilities (FR-005); clear namespace for subsequent Admin / Content Ops controllers (`admin/tracks`, etc.).

**Alternatives considered**:

- Endpoints under `/auth/admin/*` — conflates learner auth with operator APIs
- Empty admin module with only guards — still need a testable HTTP surface (FR-010)

## R5 — Local/dev admin promotion

**Decision**: Manual one-off SQL/update on Platform DB `users.role = 'admin'` for a known email; document in feature quickstart + README pointer. No auto-seed admin.

**Rationale**: Clarified options B + C; avoids accidental privileged accounts in shared DBs; User Admin will replace this later.

**Alternatives considered**:

- Auto-seed admin on bootstrap — rejected (clarification)
- Env-flag seed — deferred; adds config surface without product need

## R6 — Guard ordering and unauthenticated callers

**Decision**: Keep global order: `AppThrottlerGuard` → `JwtAuthGuard` → `RolesGuard`. Unauthenticated requests to `/admin/*` fail in `JwtAuthGuard` with `401 UNAUTHORIZED` before role check. Authenticated non-admins fail in `RolesGuard` with `403 FORBIDDEN`.

**Rationale**: Matches edge-case distinction in spec; JwtAuthGuard already global and non-public routes require JWT.

**Alternatives considered**:

- Custom combined AdminAuthGuard — unnecessary duplication of JWT + role

## R7 — Learner route non-regression

**Decision**: No changes to learner controllers' authorization metadata; do not add `@Roles(Role.ADMIN)` to learner routes. Integration smoke: `/auth/me` still works for `user` role.

**Rationale**: FR-005 / SC-005 — admin capabilities stay in admin namespace only.
