# Feature Specification: User Admin

**Feature Branch**: `024-user-admin`

**Created**: 2026-07-12

**Status**: Review

**Input**: User description: "Let admins list users and manage role (and light account controls) so operators can grant admin and support learners without direct DB access. Deliverables: admin list/search users with pagination (no password hashes or refresh tokens in responses); update user role (user ↔ admin) with guardrails (cannot remove last admin); optional MVP soft-disable/reactivate deferred unless required; audit-friendly responses (who changed what) — full Audit Log feature may come later."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-12

- Q: When an admin demotes a user, should active sessions/refresh tokens be revoked immediately? → A: No forced logout — demoted user keeps current access role until refresh or re-login (matches Admin AuthZ)
- Q: For audit-friendly role changes, what must operators see about who made the change? → A: Persist and return `updatedBy` (acting admin’s user id) + `updatedAt` on the user record
- Q: How should the admin user list be ordered by default for stable pagination? → A: `createdAt` ascending, then `id` ascending (oldest first; stable tie-break)
- Q: If an admin sets a user’s role to the same role they already have, should `updatedBy`/`updatedAt` change? → A: No-op success — leave `updatedAt` and `updatedBy` unchanged
- Q: If concurrent demotions would leave zero admins, what must the platform guarantee? → A: Atomic/serialized last-admin check — never allow zero admins; conflicting demotion fails

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Lists and Finds Users (Priority: P1)

An authenticated operator with the admin role opens the admin user directory, pages through registered accounts, and optionally filters by a search term (email or display name) so they can locate a specific learner or operator without querying the database directly.

**Why this priority**: Listing users is the entry point for all operator account support. Without a safe directory, role management and support workflows cannot start.

**Independent Test**: Can be fully tested by signing in as an admin, calling the admin user list (with and without search/pagination), and verifying returned profiles exclude secrets while including identity and role fields needed for support.

**Acceptance Scenarios**:

1. **Given** several registered users exist, **When** an admin requests the first page of the admin user list, **Then** they receive a paginated collection of user summaries (id, email, display name, role, created/updated timestamps) without password hashes or refresh tokens.
2. **Given** users with distinct emails/display names, **When** an admin searches with a matching substring, **Then** only matching users are returned within the same paginated shape.
3. **Given** more users than one page size, **When** an admin requests successive pages, **Then** results are ordered by `createdAt` ascending then `id` ascending, are non-overlapping for a fixed page size, and include enough pagination metadata to navigate (at least total count or has-next indication).
4. **Given** a non-admin authenticated user or an unauthenticated caller, **When** they call the admin user list, **Then** the request is rejected (forbidden or unauthorized) with no user directory leakage.

---

### User Story 2 - Admin Promotes or Demotes Role (Priority: P1)

An admin updates another user's role between the standard learner role and admin so operators can grant (or revoke) admin access without one-off Platform DB edits.

**Why this priority**: Replacing manual SQL promotion is the primary product goal of this feature and unblocks safe day-to-day content ops staffing.

**Independent Test**: Can be tested by listing a learner, updating their role to admin, confirming the stored role is admin, then verifying (after that user refreshes or re-logs in) they can access admin surfaces — and the reverse for demotion.

**Acceptance Scenarios**:

1. **Given** a learner account exists and at least one other admin remains, **When** an admin sets that learner’s role to admin, **Then** the change persists and admin list/detail reflects the new role.
2. **Given** an admin account that is not the sole remaining admin, **When** an operator sets that account’s role to the standard learner role, **Then** the demotion persists and that account no longer qualifies as admin after credential refresh/re-login.
3. **Given** role update succeeds, **When** the target user still holds an old access credential issued before the change, **Then** Admin AuthZ continues to trust the role on that credential until refresh or re-login (consistent with existing Admin AuthZ behavior).
4. **Given** a non-admin caller, **When** they attempt a role update, **Then** the request is rejected and no role change occurs.

---

### User Story 3 - Last-Admin Guardrail (Priority: P1)

The platform refuses role changes that would leave the system with zero admin accounts, including an admin attempting to demote themselves when they are the only admin.

**Why this priority**: Locking operators out of all admin surfaces is a severe operational failure; the backlog explicitly requires this guardrail.

**Independent Test**: Can be tested in an environment with exactly one admin by attempting to demote that admin (self or via another path) and verifying the change is rejected while the admin role remains.

**Acceptance Scenarios**:

1. **Given** exactly one admin account exists, **When** any caller attempts to change that account’s role away from admin, **Then** the platform rejects the change with a clear conflict/validation error and the account remains admin.
2. **Given** two or more admin accounts exist, **When** an admin demotes one of them (including themselves), **Then** the demotion is allowed and at least one admin remains.
3. **Given** a last-admin demotion was rejected, **When** an operator inspects the error, **Then** the message indicates that the last admin cannot be removed/demoted without leaking other users’ secrets.
4. **Given** concurrent demotion attempts that would leave zero admins, **When** both are processed, **Then** at most one succeeds and at least one admin account remains; the other fails with the last-admin error.

---

### User Story 4 - Admin Retrieves a Single User (Priority: P2)

An admin opens a single user record by stable id to confirm identity and current role before or after a role change.

**Why this priority**: Supports precise support workflows and safer role updates; list alone is enough for a minimal MVP, but detail reduces mistaken updates.

**Independent Test**: Can be tested by fetching a known user id as admin and verifying the same safe field set as list rows; unknown ids return not found.

**Acceptance Scenarios**:

1. **Given** a user exists, **When** an admin requests that user by id, **Then** they receive the safe profile summary (no secrets).
2. **Given** no user exists for the id, **When** an admin requests it, **Then** the platform returns a clear not-found response.
3. **Given** a non-admin caller, **When** they request user detail under the admin surface, **Then** access is denied.

---

### User Story 5 - Audit-Friendly Role Change Feedback (Priority: P2)

When an admin changes a user’s role, the success response (and subsequent reads) make it clear what changed, when, and which admin performed the change, so operators have a lightweight trail without requiring the full Audit Log feature.

**Why this priority**: Improves operator confidence and supportability; full append-only audit storage remains a separate backlog item.

**Independent Test**: Can be tested by performing a role update and inspecting the response/detail for updated role, `updatedAt`, and `updatedBy` (acting admin user id).

**Acceptance Scenarios**:

1. **Given** an admin updates a user’s role, **When** the operation succeeds, **Then** the response reflects the new role, an updated timestamp, and `updatedBy` set to that acting admin’s user id.
2. **Given** a subsequent admin list or detail read of that user, **When** operators inspect the record, **Then** the same latest `updatedBy` and `updatedAt` remain visible.
3. **Given** MVP without the full Audit Log feature, **When** operators need historical multi-event “who changed what” beyond the latest update metadata, **Then** that richer history is out of scope here (deferred to Audit Log).

---

### Edge Cases

- What happens when the target user id does not exist on role update? Reject with not-found; no partial write.
- What happens when the requested role equals the user’s current role? Accept as a success no-op: role unchanged and `updatedAt`/`updatedBy` MUST NOT change.
- What happens when an admin tries to set an unrecognized role value? Reject with validation error; only `user` and `admin` are allowed.
- What happens when search matches zero users? Return an empty page successfully (not an error).
- What happens when page size is missing, zero, negative, or excessively large? Apply platform defaults and enforce a maximum page size; reject clearly invalid values if outside allowed bounds.
- What is the default list sort? `createdAt` ascending, then `id` ascending; search results use the same order.
- What happens if role demotion succeeds while the target still has active sessions? Existing access credentials retain the old role until refresh/re-login; this feature does not force immediate session revocation in MVP.
- What is `updatedBy` for users never role-updated via admin APIs? Null/absent until the first admin role change; registration and non-admin profile updates do not set it.
- Are password hashes, refresh tokens, or reset tokens ever returned? Never on admin list/detail/update responses.
- Is account soft-disable / ban / hard delete included? No — out of scope for this MVP (see Assumptions).
- What happens under concurrent demotions that would leave zero admins? Check-and-update is atomic/serialized; at least one admin always remains and the conflicting demotion fails with the last-admin error.
- Can learners list or mutate other users via learner routes? No — user directory and role mutation live only under the admin operator surface.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated admins to list registered users from Platform DB with pagination. Default list order MUST be `createdAt` ascending, then `id` ascending (stable across pages).
- **FR-002**: System MUST allow authenticated admins to filter the user list by a search term that matches email and/or display name (case-insensitive substring match).
- **FR-003**: System MUST allow authenticated admins to retrieve a single user by stable id.
- **FR-004**: System MUST allow authenticated admins to update a user’s role between the standard learner role (`user`) and `admin`. When the requested role equals the current role, System MUST return success without modifying `updatedAt` or `updatedBy`.
- **FR-005**: System MUST reject any role change that would leave zero admin accounts (last-admin guardrail), including self-demotion when the caller is the sole admin. Under concurrent demotions, System MUST serialize the check-and-update so at least one admin always remains; a conflicting demotion MUST fail with the last-admin error.
- **FR-006**: System MUST NOT return password hashes, refresh tokens, or other credential secrets on any admin user list, detail, or update response.
- **FR-007**: System MUST reject admin user directory and role-mutation requests from non-admin authenticated users (forbidden) and from unauthenticated callers (unauthorized), reusing Admin AuthZ enforcement.
- **FR-008**: Admin user management capabilities MUST live under the admin operator surface and MUST NOT add user-directory or role-mutation capabilities onto learner auth/profile routes.
- **FR-009**: System MUST persist role changes on Platform DB user records that Authentication already uses (no separate shadow user store).
- **FR-010**: System MUST validate role values and identifiers and return structured, actionable errors for invalid input, not-found targets, and last-admin violations.
- **FR-011**: Successful role updates that actually change the role MUST persist and return the updated role, user `updatedAt`, and `updatedBy` (acting admin’s user id). Same-role no-ops MUST NOT refresh those fields.
- **FR-012**: System MUST NOT provide soft-disable, ban, hard delete, or password-reset of user accounts in this feature.
- **FR-013**: System MUST NOT require the full Audit Log feature; durable multi-event audit history is out of scope. Latest role-change metadata (`updatedBy` + `updatedAt`) on the user record is sufficient for MVP audit-friendliness. Admin list and detail MUST expose `updatedBy` when present.
- **FR-014**: Role changes MUST remain consistent with Admin AuthZ: enforcement continues to trust the role on the current access credential until refresh or re-login. System MUST NOT revoke refresh tokens or force logout as part of promote/demote in this feature.

### Key Entities

- **User account**: Platform identity used for authentication and authorization. Operator-visible attributes: stable id, email, display name, role (`user` | `admin`), created/updated timestamps, and optional `updatedBy` (acting admin user id of the latest admin role change; null until first such change). Secrets (password hash, refresh tokens) are never operator-visible through this feature.
- **Admin operator**: Authenticated user with admin role who may list users and change roles; not a separate identity system.
- **Role assignment**: The current `user`/`admin` role on a Platform user account; changing it is the primary mutation of this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can locate a known user via search or pagination in under 1 minute without using direct database access.
- **SC-002**: An admin can promote a learner to admin and confirm the new role on a subsequent admin read in under 1 minute.
- **SC-003**: In an environment with a single admin, 100% of attempts to demote that last admin are rejected and the account remains admin.
- **SC-004**: 100% of admin user list/detail/update responses omit password hashes and refresh tokens (verified by contract/integration checks).
- **SC-005**: Non-admin callers are denied user directory and role-mutation operations in 100% of tested attempts, with no role side effects.
- **SC-006**: Operators no longer need one-off Platform DB SQL solely to grant or revoke admin for routine staffing (documented SQL promotion becomes optional fallback only).

## Assumptions

- Soft-disable / reactivate / ban / hard delete are **out of scope** for this MVP; the backlog marked them optional and they can be a follow-up if product needs them.
- Only two roles exist today (`user`, `admin`); no custom roles or per-permission grants.
- Search is a simple case-insensitive substring over email and display name (not full-text ranking).
- Default page size is modest (e.g. 20) with a documented maximum (e.g. 100); exact numbers are design/contract details.
- Admin user list default order is `createdAt` ascending, then `id` ascending (clarified); no client-controlled sort in MVP.
- Immediate forced logout / token revocation on promote or demote is explicitly out of scope (clarified); Admin AuthZ credential-role semantics remain as already shipped.
- `updatedBy` is persisted on the user record for admin role changes only (clarified); full append-only Audit Log history remains a separate feature.
- Same-role updates are success no-ops that do not stamp `updatedAt`/`updatedBy` (clarified).
- Last-admin enforcement is race-safe via atomic/serialized check-and-update (clarified); zero admins must never occur.
- Depends on Authentication (user store, roles) and Admin AuthZ (admin-only enforcement) being Done.
- FE admin UI is out of scope; this feature delivers backend admin APIs/contracts only.
