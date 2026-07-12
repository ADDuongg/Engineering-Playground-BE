# Feature Specification: Admin AuthZ

**Feature Branch**: `020-admin-authz`

**Created**: 2026-07-12

**Status**: Done

**Input**: User description: "Enforce admin-only access for content and user management APIs using the existing Role.ADMIN claim (no separate admin identity system in MVP). Deliverables: reusable admin role guard/decorator across admin controllers; reject non-admin callers with a clear forbidden response on /api/v1/admin/*; document how to promote a user to admin in local/dev; do not expose admin capabilities on learner routes."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-12

- Q: Should admin authorization trust the role on the access credential, or re-read the user's role from Platform DB on every admin request? → A: Trust role on the current access credential; role changes apply after refresh or re-login
- Q: What minimal admin-namespace surface should this feature ship so AuthZ is integration-testable before Track & Lab Admin CRUD? → A: Read-only admin whoami/session probe under the admin namespace (identity + role confirmation only)
- Q: How should local/dev get an admin user for exercising Admin AuthZ? → A: Document manual one-off Platform DB role promotion only (no auto-seed admin)
- Q: Where should the local/dev admin promotion procedure be documented for onboarding? → A: Both: full steps in feature quickstart + short README pointer

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Accesses Protected Operator Surfaces (Priority: P1)

An authenticated operator with the admin role calls an admin-only platform operation (for example, a future content or user management endpoint under the admin API namespace). The platform recognizes their admin role and allows the request to proceed to the intended operation.

**Why this priority**: Without a reliable allow path for admins, subsequent Admin / Content Ops features cannot ship. This is the foundation for all operator workflows.

**Independent Test**: Can be fully tested by authenticating as an admin user, calling the admin whoami/session probe, and verifying the request is authorized and returns identity/role confirmation.

**Acceptance Scenarios**:

1. **Given** a signed-in user whose account role is admin, **When** they call the admin whoami/session probe, **Then** authorization succeeds and the response confirms their identity and admin role.
2. **Given** a signed-in admin, **When** they call the admin whoami/session probe after a valid session refresh, **Then** the renewed access credential still carries the admin role and authorization continues to succeed.
3. **Given** multiple protected admin endpoints share the same authorization rule, **When** an admin calls the whoami probe or any future admin endpoint using that rule, **Then** the same admin-role requirement is applied consistently.

---

### User Story 2 - Non-Admin Callers Are Clearly Denied (Priority: P1)

A signed-in learner (standard user role) or an unauthenticated caller attempts to reach an admin-namespace operation. The platform denies access with a clear forbidden (or unauthorized) response and does not execute the admin operation.

**Why this priority**: Preventing privilege escalation and accidental exposure of operator capabilities is a hard security requirement before any admin write APIs exist.

**Independent Test**: Can be tested by calling the admin whoami/session probe as a standard authenticated user and as an unauthenticated caller, verifying both are denied without side effects.

**Acceptance Scenarios**:

1. **Given** a signed-in user whose role is the standard learner role, **When** they call a protected admin-namespace endpoint, **Then** the request is rejected with a clear forbidden response and no admin side effect occurs.
2. **Given** an unauthenticated caller, **When** they call a protected admin-namespace endpoint, **Then** the request is rejected as unauthorized (not treated as an authorized admin).
3. **Given** a non-admin caller is denied, **When** they inspect the error response, **Then** they receive a structured platform error that indicates insufficient permission without leaking internal authorization details or other users' data.

---

### User Story 3 - Learner Routes Stay Free of Admin Capabilities (Priority: P1)

Learners continue to use existing learning APIs (auth profile, tracks, labs, progress, quiz, experiments) without gaining any admin-only write or management capabilities through those routes. Admin operations are confined to the admin API namespace.

**Why this priority**: The backlog explicitly requires that admin capabilities are not exposed on learner routes. Mixing them would create accidental privilege surfaces and confuse FE contracts.

**Independent Test**: Can be tested by reviewing and exercising learner-facing routes as a standard user and confirming none perform admin content/user management mutations; admin-only operations remain reachable only under the admin namespace with admin role.

**Acceptance Scenarios**:

1. **Given** a standard learner is signed in, **When** they use existing learner routes (profile, catalog, progress, quiz, experiments), **Then** those routes behave as before and do not expose admin create/update/delete of tracks, labs, quizzes, or user roles.
2. **Given** an admin is signed in, **When** they use learner routes, **Then** learner routes continue to serve learning behavior only; operator mutations still require the admin namespace (and admin role).
3. **Given** a future admin content API is mounted under the admin namespace, **When** the same capability is not offered on a learner path, **Then** non-admin clients cannot invoke it by calling a learner URL.

---

### User Story 4 - Local/Dev Admin Promotion Is Documented (Priority: P2)

A developer setting up the platform locally can promote an existing user account to admin using a documented, one-off Platform DB role update (no auto-seeded admin account) so they can exercise admin APIs without a full User Admin feature yet.

**Why this priority**: Blocks local verification of Admin AuthZ and all dependent Admin / Content Ops features. Lower than runtime enforcement because it is operator documentation, not the authorization mechanism itself.

**Independent Test**: Can be tested by following the documented promotion steps on a fresh local environment, signing in as that user, and successfully calling a protected admin endpoint.

**Acceptance Scenarios**:

1. **Given** a developer has a registered local user, **When** they follow the documented one-off Platform DB promotion procedure and sign in again (or refresh), **Then** that user's role becomes admin on the access credential and the admin whoami probe succeeds.
2. **Given** the documentation for admin promotion (feature quickstart with full steps and a README pointer), **When** a new engineer onboards, **Then** they can promote a user without reverse-engineering the schema, without relying on an auto-seeded admin, and without asking the team.
3. **Given** promotion is a local/dev manual procedure for MVP, **When** production-safe bulk user management is needed later, **Then** that remains out of scope here and belongs to User Admin.

---

### Edge Cases

- What happens when an access credential is valid but the role claim is missing or unrecognized? Treat as non-admin and deny admin-namespace access.
- What happens when a user's role was changed to admin (or demoted) after the current access credential was issued? Until refresh or re-login, authorization uses the role present on the current credential; after refresh/re-login, the new role applies. Admin AuthZ does not re-read Platform DB role per request in MVP.
- What happens when an endpoint is under the admin namespace but forgets to declare the admin requirement? Feature deliverable requires a consistent, reusable enforcement pattern so new admin controllers opt in safely; checklist for subsequent admin features includes applying the shared rule.
- How does the system distinguish unauthorized (not signed in) from forbidden (signed in but not admin)? Unauthenticated → unauthorized; authenticated non-admin → forbidden.
- What if someone calls a learner route with an admin credential? Learner routes remain available; no extra admin powers are granted solely by holding an admin credential on those routes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authorize admin-namespace operations only for authenticated users whose role on the current access credential is admin (credential role is authoritative per request; Platform DB role is not re-read for AuthZ in MVP).
- **FR-002**: System MUST reject authenticated non-admin callers of admin-namespace operations with a clear forbidden response using the platform's standard error envelope.
- **FR-003**: System MUST reject unauthenticated callers of admin-namespace operations before treating them as authorized admins (unauthorized, not silent allow).
- **FR-004**: System MUST provide a reusable authorization mechanism (shared rule usable by all admin controllers) so each new admin feature does not invent its own role check.
- **FR-005**: System MUST NOT expose admin content or user-management capabilities on learner-facing routes; those capabilities belong only under the admin API namespace.
- **FR-006**: System MUST reuse the existing user role model (standard user vs admin) — no separate admin identity, second login system, or parallel credential type in MVP.
- **FR-007**: Admin role used for authorization MUST be the same role already issued at login/register/refresh and visible on the authenticated profile where role is returned today.
- **FR-008**: Project documentation MUST describe a manual one-off Platform DB procedure to promote a user to admin in local/dev (no auto-seeded admin account in MVP), including how to verify the role after promotion via sign-in/refresh and the admin whoami probe. Full steps MUST live in the feature quickstart; the root README MUST include a short pointer to that procedure.
- **FR-009**: Forbidden/unauthorized admin AuthZ failures MUST NOT leak password hashes, refresh tokens, or other users' private data.
- **FR-010**: System MUST expose a read-only admin whoami/session probe under the admin namespace that returns the caller's identity and confirms admin access, using the same shared authorization rule as future admin APIs. The probe MUST NOT mutate platform or playground data.

### Key Entities

- **User Role**: Platform identity attribute distinguishing standard learners (`user`) from operators (`admin`). Issued with authentication credentials; drives Admin AuthZ decisions.
- **Admin Namespace**: Logical group of operator APIs under the versioned admin path prefix. All routes in this namespace require admin authorization.
- **Learner Routes**: Existing non-admin platform and experiment APIs used by learners; must not gain admin mutation capabilities via this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of requests to protected admin-namespace endpoints by non-admin authenticated users are denied with a forbidden outcome (no successful admin side effect).
- **SC-002**: 100% of requests to protected admin-namespace endpoints by unauthenticated callers are denied as unauthorized.
- **SC-003**: An admin user can complete an authorized call to a protected admin-namespace endpoint on the first attempt after sign-in (authorization is not a source of flaky failures).
- **SC-004**: A new engineer following local/dev docs can promote a user to admin and verify admin access in under 10 minutes without tribal knowledge.
- **SC-005**: No learner-facing route introduced or modified by this feature grants admin content/user-management mutations to standard users.
- **SC-006**: Subsequent Admin / Content Ops features can apply the same shared authorization rule without redesigning identity (verified by design review / reuse checklist).

## Assumptions

- Authentication (register, login, refresh, profile, JWT role claim) is already Done and remains the identity source.
- `Role.ADMIN` / `Role.USER` already exist in the shared role model; this feature enforces them for admin APIs rather than introducing new roles.
- MVP does not require a separate admin portal login, SSO, MFA, or IP allowlisting.
- Full User Admin (list users, change roles via API) is a later feature; local/dev promotion is manual one-off Platform DB update documented in feature quickstart with a short README pointer — no auto-seed admin account.
- Track & Lab Admin CRUD and other admin write APIs are out of scope; this feature ships AuthZ foundation plus a read-only admin whoami/session probe only.
- FE admin UI is out of scope (PRD §23); this feature is backend AuthZ only.
- Role on the access credential is authoritative for each request in MVP (clarified); forcing immediate revocation of elevated access mid-token-lifetime is deferred to User Admin / future session revocation unless already supported by logout/refresh rotation.
- Global auth guards already protect authenticated routes; Admin AuthZ adds role checks on top for the admin namespace.
