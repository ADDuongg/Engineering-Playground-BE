# Feature Specification: Per-User Rate Limit

**Feature Branch**: `010-per-user-rate-limit`

**Created**: 2026-07-08

**Status**: Review

**Input**: User description: "Replace global-only API throttling with per-user execution limits so one learner cannot exhaust shared playground capacity and fair-use policies apply per identity (PRD §20, ENGINEERING_GUIDE §12)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fair Limits on Expensive Experiment Operations (Priority: P1)

A signed-in learner runs SQL experiments, EXPLAIN commands, dataset resets, and benchmark jobs during a lab session. The platform enforces per-user limits on these expensive operations so one learner cannot monopolize shared playground capacity, while routine browsing and profile access remain unaffected.

**Why this priority**: Database Track labs depend on SQL and EXPLAIN execution. Without per-user limits, a single heavy user can degrade the experience for everyone. This is the core fair-use guarantee the feature must deliver.

**Independent Test**: Can be fully tested by executing expensive operations under one user identity until the limit is reached, verifying subsequent requests are rejected with a clear rate-limit response while a different user on the same platform continues unaffected.

**Acceptance Scenarios**:

1. **Given** a signed-in learner has not exceeded their SQL run limit, **When** they submit a valid experiment SQL request, **Then** execution proceeds normally.
2. **Given** a signed-in learner has reached their SQL run limit within the current window, **When** they submit another SQL run, **Then** the request is rejected before playground execution with a rate-limit error and guidance on when to retry.
3. **Given** two different signed-in learners on the same platform, **When** one learner exhausts their personal limit, **Then** the other learner's operations continue without degradation from the first learner's usage.
4. **Given** a signed-in learner requests profile or track browsing endpoints, **When** they are within normal API usage, **Then** lightweight read operations are not subject to the same strict experiment-operation limits.

---

### User Story 2 - Operation-Specific Limit Tiers (Priority: P1)

Different experiment operations carry different cost profiles. The platform applies separate limit tiers for SQL runs, EXPLAIN runs, benchmark job submissions, and dataset resets so learners receive proportionate allowances per activity type.

**Why this priority**: A single global counter would either over-restrict cheap operations or under-protect expensive ones. Operation-specific tiers balance learning freedom with infrastructure protection.

**Independent Test**: Can be tested by independently exhausting each operation type's limit and verifying other operation types remain available until their own limits are reached.

**Acceptance Scenarios**:

1. **Given** a learner reaches their EXPLAIN limit, **When** they attempt another EXPLAIN, **Then** only EXPLAIN is blocked while SQL runs (if under limit) still succeed.
2. **Given** a learner reaches their dataset reset limit, **When** they attempt another reset, **Then** reset is blocked with an operation-specific message while other allowed operations continue.
3. **Given** a learner reaches their benchmark enqueue limit, **When** they submit another benchmark job, **Then** enqueue is rejected without affecting SQL or EXPLAIN quotas.
4. **Given** platform operators configure different limits per operation type, **When** limits are applied, **Then** each tier uses its configured threshold independently.

---

### User Story 3 - Actionable Rate-Limit Feedback for Learners (Priority: P1)

When a learner hits a limit, they receive a clear, educational error that explains what happened and when they can try again — not a generic failure message.

**Why this priority**: Learning-first UX requires transparent errors. Opaque "request failed" messages cause frustration and support burden during lab sessions.

**Independent Test**: Can be tested by triggering a rate-limit rejection and verifying the response includes operation context, a retry-after indication, and consistent error categorization across all limited endpoints.

**Acceptance Scenarios**:

1. **Given** a learner exceeds a rate limit, **When** the platform rejects the request, **Then** the error identifies the operation type (e.g., SQL run, EXPLAIN) and states that fair-use limits were reached.
2. **Given** a learner exceeds a rate limit, **When** the platform rejects the request, **Then** the response includes guidance on approximately when they can retry.
3. **Given** a learner receives a rate-limit error, **When** they wait until the limit window resets, **Then** the same operation succeeds on the next attempt.
4. **Given** any rate-limited endpoint rejects a request, **When** the error is returned, **Then** it uses the same structured error category so clients and labs can handle it consistently.

---

### User Story 4 - Anonymous and Session-Scoped Fallback (Priority: P2)

Where the platform allows lab access without a full account, rate limits still apply using a session-scoped identity so anonymous usage cannot bypass fair-use policies.

**Why this priority**: Fair-use must cover all experiment execution paths, but authenticated per-user limits are the primary MVP path. Session fallback prevents abuse without blocking the anonymous preview flows the product may allow.

**Independent Test**: Can be tested by running expensive operations from an unauthenticated session and verifying limits apply to that session without affecting authenticated users.

**Acceptance Scenarios**:

1. **Given** an anonymous learner with a valid experiment session, **When** they execute expensive operations, **Then** limits are keyed to the session identity.
2. **Given** an anonymous session reaches its limit, **When** a different anonymous session runs operations, **Then** limits are tracked independently per session.
3. **Given** an anonymous learner signs in mid-session, **When** they continue experiments, **Then** limits apply under their authenticated user identity going forward.

---

### User Story 5 - Global Safety Ceiling as Backstop (Priority: P2)

The platform retains a global rate ceiling across all traffic so extreme load or coordinated abuse cannot overwhelm the API even if per-user limits are misconfigured or evaded.

**Why this priority**: Per-user limits are the primary control, but a global backstop protects platform stability during incidents or configuration errors.

**Independent Test**: Can be tested by verifying that aggregate traffic beyond the global ceiling is rejected regardless of individual user headroom.

**Acceptance Scenarios**:

1. **Given** aggregate request volume exceeds the global safety ceiling, **When** new requests arrive, **Then** excess traffic is throttled even if individual users are under their personal limits.
2. **Given** per-user limits are active, **When** global and per-user checks both apply, **Then** the stricter applicable limit wins for the request.
3. **Given** normal platform load, **When** learners operate within fair use, **Then** the global ceiling does not interfere with typical lab sessions.

---

### Edge Cases

- What happens when a learner sends concurrent requests at the limit boundary? The platform counts each qualifying request atomically so brief bursts cannot exceed the configured window by more than one race-condition request; limits remain predictable.
- What happens when rate-limit storage is temporarily unavailable? The platform fails closed for expensive operations (reject with a service-unavailable style message) rather than allowing unbounded execution that could harm shared playground capacity.
- What happens when a request is rejected by sandbox validation before execution? Sandbox validation failures do not consume experiment-operation quota; only requests that pass validation and proceed to execution (or enqueue) count toward limits.
- What happens when an authenticated user's token is valid but account is deleted mid-session? Subsequent expensive operations are rejected as unauthorized; stale identity does not receive a fresh quota.
- What happens when limits are set to zero or unreasonably low in configuration? The platform enforces configured values but validates minimum sensible defaults at startup to prevent accidental total lockout in non-production environments.
- What happens for internal or test accounts with elevated limits? When the optional elevated-limits capability is enabled, designated accounts receive higher thresholds without disabling limits entirely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce per-user rate limits on expensive experiment operations for authenticated learners, keyed by stable user identity.
- **FR-002**: System MUST maintain separate limit tiers for at minimum: SQL run, EXPLAIN run, benchmark job enqueue, and dataset reset.
- **FR-003**: System MUST reject limit-exceeded requests before playground execution or job enqueue, not after work has started.
- **FR-004**: System MUST return structured rate-limit errors that identify the operation type and include retry-after guidance.
- **FR-005**: System MUST allow platform operators to configure per-operation limits and window duration without code changes.
- **FR-006**: System MUST retain a global safety ceiling that applies across all clients as a backstop to per-user limits.
- **FR-007**: System MUST apply session-scoped limits for anonymous experiment access where such access is supported.
- **FR-008**: System MUST NOT count sandbox validation failures toward experiment-operation quotas.
- **FR-009**: System MUST record rate-limit rejection events for observability (user or session, operation type, endpoint).
- **FR-010**: System MAY support elevated limits for designated internal or test accounts when explicitly enabled via configuration.

### Key Entities

- **Rate Limit Policy**: Defines operation type, allowed requests per window, window duration, and whether the policy applies to authenticated users, sessions, or both.
- **Rate Limit Counter**: Tracks consumption for a given identity (user or session) and operation type within the active window.
- **Rate Limit Event**: Observability record emitted when a request is rejected for exceeding limits, including identity, operation, and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Under normal lab usage, 95% of learners complete a typical 30-minute Database Track session without hitting rate limits.
- **SC-002**: When a learner exceeds a limit, 100% of rejections include operation-specific context and retry-after guidance (verifiable via acceptance tests).
- **SC-003**: One learner exhausting all personal experiment quotas does not increase error rates for other concurrent learners on the same platform (isolation verified in load tests).
- **SC-004**: Expensive operations rejected for rate limiting are blocked before playground execution in 100% of tested cases (no partial execution charged against quota incorrectly).
- **SC-005**: Platform operators can change per-operation limits through configuration and see the new thresholds take effect without redeploying application code.

## Assumptions

- Authentication (register, login, session refresh) is available and provides a stable user identity for signed-in learners.
- SQL Sandbox validation runs before experiment execution; only validated requests that proceed count toward quotas.
- Default limit values follow reasonable lab-session patterns (e.g., on the order of tens of SQL runs and fewer EXPLAIN runs per minute per user) unless operators override them.
- Redis or equivalent shared infrastructure is available for distributed counter storage in multi-instance deployments; single-instance development may use an in-process fallback with the same semantics.
- Global API throttling already exists as a coarse backstop; this feature adds identity-aware limits on top without removing the global ceiling.
- Elevated limits for internal accounts are optional for MVP and gated behind explicit configuration.
- Benchmark and dataset reset endpoints exist or will exist; limits are defined now so they apply when those paths are invoked.

## Dependencies

- **Authentication** (Done): Provides user identity for per-user keying.
- **SQL Sandbox & Resource Limits** (Done): Defines which operations are expensive and validates before execution.

## Out of Scope

- Billing, subscription tiers, or paid quota upgrades.
- Per-IP geo-blocking or bot detection beyond rate limiting.
- Replacing sandbox per-query timeout and row caps (complementary, not superseded).
- UI visualization of remaining quota (may be a future enhancement).
- Cross-region rate-limit synchronization beyond standard shared storage semantics.
