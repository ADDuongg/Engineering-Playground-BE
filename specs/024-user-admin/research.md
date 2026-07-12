# Research: User Admin

**Feature**: `024-user-admin` | **Date**: 2026-07-12

## R1 — Module placement

**Decision**: Add `AdminUsersController` under existing `src/modules/admin/` with class-level `@Roles(Role.ADMIN)`. Persist via extended `UserRepository` exported from `AuthModule`.

**Rationale**: Matches Admin AuthZ / Track & Lab Admin / Quiz Admin patterns; keeps learner `/auth/*` free of operator mutations (FR-008).

**Alternatives considered**:

- Endpoints on `AuthController` with role checks — mixes learner auth with operator directory
- New `users-admin` module with duplicate entity — unnecessary split

## R2 — `updatedBy` persistence

**Decision**: Add nullable `updated_by uuid` column on `users`, FK to `users(id)` ON DELETE SET NULL. Set only when an admin role update actually changes the role. Expose as `updatedBy` on admin list/detail/update responses.

**Rationale**: Clarification — persist who changed the role without a full Audit Log table. SET NULL avoids blocking user deletion if hard-delete is added later.

**Alternatives considered**:

- Ephemeral `updatedBy` in response only — fails “subsequent reads” acceptance
- Separate audit_events table — belongs to Audit Log feature; deferred

## R3 — Session / token behavior on demotion

**Decision**: Do not revoke refresh tokens or force logout on promote/demote. Admin AuthZ continues to trust the role on the current access credential until refresh/re-login.

**Rationale**: Spec clarification + consistency with Admin AuthZ. Avoids new token lifecycle coupling in this feature.

**Alternatives considered**:

- Revoke refresh tokens on demotion — stronger immediate lockout; deferred
- Shorten access-token TTL — product/infra change outside scope

## R4 — Last-admin race safety

**Decision**: Perform role demotion inside a Platform DB transaction: lock relevant admin rows (or use `SELECT … FOR UPDATE` on the target plus a count of admins with `role = 'admin'`), then reject if demoting would leave zero admins. Conflicting concurrent demotion fails with `CONFLICT`.

**Rationale**: Clarification requires never allowing zero admins under concurrency. Transactional check-and-update is the simplest correct approach for MVP volume.

**Alternatives considered**:

- Best-effort pre-check without lock — race can leave zero admins; rejected
- Advisory lock only — workable but less transparent than row locking around the count

## R5 — Pagination and search

**Decision**: Reuse existing `PaginationDto` (`page` default 1, `limit` default 20, max 100). Add optional `q` query for case-insensitive substring match on `email` OR `display_name`. Order always `created_at ASC, id ASC`. Return `meta.pagination` with `page`, `limit`, `total`.

**Rationale**: Spec assumptions match existing DTO; stable sort from clarification; total enables FE page controls.

**Alternatives considered**:

- Cursor pagination — overkill for admin directory MVP
- Client-controlled sort — out of scope (clarified fixed order)

## R6 — Same-role no-op

**Decision**: If requested `role` equals current `role`, return 200 with current admin user view without writing `updated_at`/`updated_by`.

**Rationale**: Clarification — preserve “last real role change” semantics for audit fields.

**Alternatives considered**:

- Always stamp metadata — noisy; rejected
- Reject as validation error — worse UX for idempotent clients; rejected

## R7 — Error codes

**Decision**:

| Situation | HTTP | `error.code` |
|-----------|------|--------------|
| Unauthenticated | 401 | `UNAUTHORIZED` |
| Non-admin | 403 | `FORBIDDEN` |
| User not found | 404 | `NOT_FOUND` |
| Invalid role / query | 400 | `VALIDATION_ERROR` |
| Last-admin demotion | 409 | `CONFLICT` |

**Rationale**: Aligns with existing admin catalog and auth envelopes (`ErrorCode` enum).

**Alternatives considered**: Dedicated `LAST_ADMIN` code — unnecessary; message text carries operator guidance
