# Feature Specification: Authentication

**Feature Branch**: `009-authentication`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Secure user access with register, login, session refresh, and profile (ROADMAP §Authentication, MVP §Login)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an Account (Priority: P1)

A new learner visits the platform and creates an account with email, password, and display name so they can save progress and access personalized lab experiences.

**Why this priority**: Account creation is the entry point for the MVP user journey. Without registration, learners cannot persist progress, bookmarks, or quiz scores across sessions.

**Independent Test**: Can be fully tested by submitting valid registration details and verifying the learner receives account credentials and can immediately access their profile. Delivers a standalone onboarding path.

**Acceptance Scenarios**:

1. **Given** a visitor provides a valid email, password meeting minimum strength, and display name, **When** they complete registration, **Then** an account is created and they receive credentials to access the platform.
2. **Given** a visitor attempts to register with an email already in use, **When** they submit registration, **Then** they receive a clear message that the email is already registered without revealing whether the password was correct.
3. **Given** a visitor submits invalid registration data (malformed email, password too short, display name out of range), **When** they submit registration, **Then** they receive specific validation guidance for each invalid field.

---

### User Story 2 - Sign In to the Platform (Priority: P1)

A returning learner signs in with email and password to resume labs, view progress, and run experiments under their identity.

**Why this priority**: Login is the primary MVP goal ("A user should be able to Login"). It unlocks all authenticated platform features including lab browsing, progress tracking, and per-user rate limits.

**Independent Test**: Can be tested by signing in with valid credentials and verifying access to protected capabilities (e.g., profile). Delivers immediate value for returning users.

**Acceptance Scenarios**:

1. **Given** a registered user provides correct email and password, **When** they sign in, **Then** they receive credentials and can access protected platform features.
2. **Given** a user provides an unknown email or incorrect password, **When** they attempt to sign in, **Then** they receive a single generic error message that does not reveal whether the email exists.
3. **Given** a user exceeds allowed sign-in attempts in a short period, **When** they try again, **Then** they are temporarily blocked with guidance on when to retry.

---

### User Story 3 - Maintain an Active Session (Priority: P1)

A signed-in learner continues using the platform without being interrupted when their short-lived access credential expires, as long as their session remains valid.

**Why this priority**: Lab sessions and experiments can exceed short access-credential lifetimes. Seamless session renewal prevents mid-experiment sign-out and supports the learning-first UX principle.

**Independent Test**: Can be tested by allowing an access credential to expire, refreshing the session, and verifying the learner can continue without re-entering password.

**Acceptance Scenarios**:

1. **Given** a signed-in user with a valid long-lived session credential, **When** their short-lived access credential expires, **Then** the platform can renew access without requiring password re-entry.
2. **Given** a user submits a valid session renewal request, **When** renewal succeeds, **Then** previously issued session credentials for that renewal chain are invalidated (rotation).
3. **Given** a user submits an expired or revoked session credential for renewal, **When** renewal is attempted, **Then** they are signed out and prompted to sign in again.

---

### User Story 4 - View Profile (Priority: P2)

A signed-in learner views their profile (display name, email, account creation date) to confirm they are in the correct account.

**Why this priority**: Profile confirms identity and supports trust before learners invest time in labs. Lower priority than sign-in flows because it depends on successful authentication.

**Independent Test**: Can be tested by requesting profile while authenticated and verifying returned fields match the registered account.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they request their profile, **Then** they receive their id, email, display name, role, and account creation date.
2. **Given** an unauthenticated request, **When** profile is requested, **Then** access is denied with a clear unauthorized message.
3. **Given** a valid credential references a deleted account, **When** profile is requested, **Then** the user receives a not-found response and must sign in again.

---

### User Story 5 - Sign Out Securely (Priority: P2)

A signed-in learner signs out when finished, ensuring their session cannot be reused on shared or public devices.

**Why this priority**: Secure logout protects learners on shared machines. Essential for production but not blocking initial sign-up/sign-in MVP validation.

**Independent Test**: Can be tested by signing out and verifying session credentials can no longer renew access or access protected endpoints.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they sign out, **Then** their active session credentials are revoked and they can no longer access protected features.
2. **Given** a user signs out, **When** they attempt to renew access with the previously issued session credential, **Then** renewal fails and they must sign in again.
3. **Given** a user submits logout with an already-revoked session credential, **When** logout is processed, **Then** the operation completes successfully (idempotent) and local client state should still clear.

---

### Edge Cases

- What happens when registration or login requests exceed rate limits? The system returns a rate-limit response with retry guidance; no account state is leaked.
- How does the system handle concurrent sessions on multiple devices? Each device can hold independent session credentials; revoking one device’s session via logout does not invalidate other active sessions unless a global revoke-all policy is added (out of scope for MVP).
- What happens when password validation fails? Specific field-level messages are returned; passwords are never echoed in responses or logs.
- How are email addresses normalized? Emails are stored and matched case-insensitively (normalized to lowercase) to prevent duplicate accounts differing only by casing.
- What happens when protected endpoints receive missing or malformed credentials? A consistent unauthorized response is returned; clients may attempt one session renewal before redirecting to sign-in.
- Are anonymous lab previews allowed before sign-in? Public discovery endpoints (Track catalog, lab listing where configured) remain accessible without authentication; experiment execution and progress features require sign-in per platform policy.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow new users to register with email, password, and display name.
- **FR-002**: System MUST validate registration input (email format, password length 8–72 characters, display name 2–100 characters) and reject unknown fields.
- **FR-003**: System MUST prevent duplicate accounts for the same normalized email address.
- **FR-004**: System MUST allow registered users to sign in with email and password.
- **FR-005**: System MUST return the same error message for unknown email and incorrect password during sign-in.
- **FR-006**: System MUST issue short-lived access credentials and long-lived refresh credentials upon successful registration or sign-in.
- **FR-007**: System MUST support session renewal using a valid refresh credential, issuing a new access and refresh pair and revoking the submitted refresh credential (rotation).
- **FR-008**: System MUST expose a profile endpoint returning the authenticated user’s id, email, display name, role, and created-at timestamp.
- **FR-009**: System MUST allow authenticated users to sign out by revoking their refresh credential.
- **FR-010**: Logout MUST be idempotent when the refresh credential is already revoked or unknown.
- **FR-011**: Protected platform endpoints MUST require a valid access credential unless explicitly marked public.
- **FR-012**: Auth endpoints MUST use the standard API response envelope except logout, which returns no content on success.
- **FR-013**: System MUST apply rate limits on registration, sign-in, and session renewal to mitigate abuse.
- **FR-014**: User credentials and refresh tokens MUST be stored securely; passwords MUST be hashed and never returned in API responses.
- **FR-015**: User account data MUST persist on the Platform database, separate from playground experiment state.
- **FR-016**: System MUST assign a default learner role (`user`) at registration; elevated roles (e.g., admin) are out of scope for self-service registration.
- **FR-017**: System MUST return structured, actionable error codes (validation, conflict, unauthorized, rate limited) suitable for frontend display.

### Key Entities

- **User Account**: A platform identity with unique normalized email, hashed password, display name, role, and creation timestamp. Stored on Platform DB; survives playground resets.
- **Access Credential**: Short-lived token authorizing API requests; expires after a configurable interval (default ~15 minutes).
- **Refresh Credential**: Long-lived opaque token used solely to obtain new access credentials; stored server-side with revocation support; expires after a configurable interval (default ~7 days).
- **Role**: Authorization label on user accounts (`user` for learners, `admin` for operators). MVP registration creates `user` role only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new learner can complete registration and reach their profile in under 2 minutes on first attempt.
- **SC-002**: 95% of sign-in attempts with valid credentials succeed on the first try under normal load.
- **SC-003**: Session renewal completes without password re-entry in under 3 seconds for 99% of requests under normal load.
- **SC-004**: After sign-out, previously issued refresh credentials fail renewal 100% of the time in integration tests.
- **SC-005**: Registration, sign-in, and profile flows pass all defined integration test scenarios before feature is marked Done.
- **SC-006**: Zero plaintext passwords appear in logs, error responses, or API payloads across auth flows.

## Assumptions

- MVP authentication uses email and password; social login (OAuth) and password reset are out of scope for this feature.
- Frontend sign-in/register UI is a separate backlog feature (Landing Page, etc.); this feature delivers the backend auth capability and shared types consumable by future frontend work.
- A partial backend auth module already exists; implementation may extend existing code rather than greenfield, but all acceptance scenarios must pass before Done.
- Default access credential lifetime is ~15 minutes; default refresh credential lifetime is ~7 days; values are configurable via environment.
- Rate limits for MVP use IP-based throttling on auth endpoints; per-user rate limits are a separate backlog feature.
- User accounts are the identity anchor for progress tracking, bookmarks, and per-user rate limits in downstream features.
- Shared auth types (`UserProfile`, `AuthTokens`, `Role`) are exported from `@db-play/types` for frontend consumption when the web app is built.
