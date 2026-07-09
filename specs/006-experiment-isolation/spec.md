# Feature Specification: Experiment Isolation

**Feature Branch**: `006-experiment-isolation`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Ensure each experiment session operates in an isolated runtime context for its Track. Session-scoped runtime identity per user experiment. No dependency on prior experiment executions. Clear separation from Platform DB. Database Track uses Playground PostgreSQL. Recovery path when isolation fails."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-08

No clarification questions required. Spec completed with documented assumptions for MVP session-scoped PostgreSQL schema isolation on Database Track, anonymous session identity until Authentication ships, and coordination with existing Dataset Loader, Dataset Reset, and Experiment Runner features.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner Gets a Dedicated Experiment Runtime (Priority: P1)

A learner opens a Database Track lab and begins an experiment. The platform assigns a unique experiment session with its own disposable runtime context on Playground PostgreSQL. All dataset preparation, SQL execution, and reset operations for that lab visit run inside this session context — the learner never shares playground tables or schema objects with other concurrent learners.

**Why this priority**: Without session-scoped runtime identity, concurrent learners overwrite each other's experiment state and labs become unreliable in multi-user environments.

**Independent Test**: Start two experiment sessions for the same lab dataset concurrently; mutate data in session A; verify session B's queries and row counts remain at baseline.

**Acceptance Scenarios**:

1. **Given** a learner starts a lab experiment, **When** the platform provisions runtime context, **Then** the learner receives a session-scoped identity that all subsequent playground operations for that visit must use.
2. **Given** two learners run the same lab concurrently, **When** each executes SQL against the same dataset family and tier, **Then** mutations in one session are invisible to the other.
3. **Given** a learner returns to a lab with an active session identity, **When** they continue the experiment, **Then** their prior in-session changes remain available until reset or session teardown.
4. **Given** a learner starts a new experiment session, **When** provisioning completes, **Then** the session begins from the lab's configured dataset baseline — not from another learner's leftover state.

---

### User Story 2 - Experiments Do Not Depend on Prior Executions (Priority: P1)

A learner completes one experiment attempt, starts a fresh session, or follows a lab's "start over" flow. Each new session receives a clean runtime context equivalent to a freshly prepared baseline for the lab's dataset identity — independent of what any previous session (same user or different user) executed.

**Why this priority**: Reproducible learning requires that experiment outcomes depend only on the learner's current actions, not hidden state from earlier runs.

**Independent Test**: Session A creates indexes and inserts rows; tear down or expire session A; start session B for the same lab; verify session B matches documented baseline without manual operator intervention.

**Acceptance Scenarios**:

1. **Given** a prior session modified playground schema or data, **When** a new session is provisioned for the same lab, **Then** the new session reflects the documented dataset baseline only.
2. **Given** a learner triggers dataset reset within an active session, **When** reset completes, **Then** only that session's runtime context is restored — other active sessions are unaffected.
3. **Given** a session ends (explicit close or expiry), **When** teardown runs, **Then** all disposable objects created in that session are removed from the playground runtime.
4. **Given** repeated session provisioning for the same lab configuration, **When** each session reaches ready state, **Then** automated tests confirm equivalent baseline structures and counts across sessions.

---

### User Story 3 - Platform Data Stays Separate from Experiment Runtime (Priority: P1)

Learner progress, Track catalog, lab definitions, and authentication records live in permanent platform storage. Experiment isolation ensures runtime provisioning, SQL execution, and teardown never read or write platform records — and platform APIs never store playground row data.

**Why this priority**: Platform/playground separation is a constitutional requirement; session isolation must not weaken this boundary.

**Independent Test**: Record platform database counts before and after session provisioning, SQL execution, and teardown across multiple sessions; verify zero change to platform tables while playground state differs per session.

**Acceptance Scenarios**:

1. **Given** experiment sessions are provisioned and torn down, **When** operators inspect platform database tables, **Then** user, track, and progress records are unchanged except for allowed session metadata references (identifiers, timestamps — not playground row payloads).
2. **Given** SQL runs inside an isolated session, **When** execution completes, **Then** only the session's playground runtime context is affected.
3. **Given** session provisioning fails midway, **When** the failure is handled, **Then** no partial playground state is attributed to platform permanent storage.

---

### User Story 4 - Track-Appropriate Runtime Adapter Resolution (Priority: P2)

Each Track declares which Runtime Adapter handles its experiments. For Database Track labs, isolation provisions Playground PostgreSQL context. The isolation contract is Track-aware so future Tracks (Redis, React Rendering) can plug in their own disposable runtime without changing the lab lifecycle.

**Why this priority**: Multi-track architecture is a platform goal, but MVP validates isolation on Database Track first.

**Independent Test**: Request isolation for a Database Track lab and verify Playground PostgreSQL context is provisioned; request isolation metadata for a non-database Track stub and verify the platform returns a clear unsupported or deferred response without corrupting Database Track sessions.

**Acceptance Scenarios**:

1. **Given** a lab belongs to Database Track, **When** isolation is requested, **Then** the platform provisions Playground PostgreSQL session context using the lab's configured dataset identity.
2. **Given** a lab references a Track whose Runtime Adapter is not yet implemented, **When** isolation is requested, **Then** the learner receives an actionable message that the Track runtime is unavailable — not a silent fallback to Database Track.
3. **Given** downstream features (dataset prepare, reset, experiment run) receive a session identity, **When** they execute, **Then** they operate within the resolved Runtime Adapter context without re-resolving Track metadata independently.

---

### User Story 5 - Recovery When Isolation Fails (Priority: P2)

Provisioning or teardown of an experiment session can fail due to resource limits, playground connectivity, or partial cleanup. Learners and support staff receive clear, actionable feedback; the platform attempts safe recovery without leaving orphaned runtime objects or blocking future sessions indefinitely.

**Why this priority**: Operational resilience supports production reliability but core happy-path isolation is more critical.

**Independent Test**: Simulate provisioning failure and partial teardown; verify learner-facing error, audit record, and ability to start a replacement session.

**Acceptance Scenarios**:

1. **Given** session provisioning fails, **When** the learner attempts to run an experiment, **Then** they receive a categorized isolation error with guidance to retry or refresh the lab — not an opaque database failure.
2. **Given** provisioning fails after creating partial runtime objects, **When** recovery runs, **Then** orphaned disposable objects are cleaned up or marked for cleanup before a retry is accepted.
3. **Given** session teardown fails, **When** support reviews audit logs, **Then** logs include session identity, failure category, and correlation identifiers suitable for troubleshooting.
4. **Given** a learner retries after a failed provisioning, **When** the retry succeeds, **Then** the session reaches the same ready baseline as a first-attempt success.

---

### Edge Cases

- What happens when the same client requests two concurrent sessions for the same lab — should the platform reuse the active session or create a second context? MVP reuses the most recent active session per client session identifier to avoid unbounded schema proliferation.
- How does the system behave when playground connection pool is exhausted during provisioning? Return a retryable isolation error with estimated wait guidance rather than blocking indefinitely.
- What happens when dataset preparation is in progress for a newly provisioned session? Readiness gates (existing Dataset Loader contract) apply per session — SQL execution remains blocked until that session's dataset is ready.
- How are long-idle sessions reclaimed? Sessions expire after a configurable idle TTL; teardown runs asynchronously and audit logs record expiry reason.
- What happens when Authentication is not yet available? Anonymous lab access uses a stable client-supplied or server-issued session token as the isolation key until user identity is integrated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST assign a unique experiment session identity for each lab visit that requires disposable runtime state.
- **FR-002**: System MUST provision an isolated Playground PostgreSQL runtime context for Database Track experiment sessions before dataset preparation or SQL execution proceeds.
- **FR-003**: System MUST route Dataset Loader preparation, Dataset Reset, and Experiment Runner execution through the active session's runtime context — never a shared global playground namespace.
- **FR-004**: System MUST guarantee that playground mutations in one experiment session are not visible to any other concurrent session.
- **FR-005**: System MUST ensure new experiment sessions start from the lab's configured dataset baseline independent of prior sessions' mutations.
- **FR-006**: System MUST tear down disposable runtime objects when a session ends, expires, or is explicitly closed.
- **FR-007**: System MUST keep platform permanent data separate from playground runtime content — session metadata on the platform MUST NOT include playground row payloads.
- **FR-008**: System MUST resolve the correct Runtime Adapter from the lab's Track and reject isolation requests for unsupported Tracks with actionable errors.
- **FR-009**: System MUST expose session readiness state (provisioning, ready, failed, tearing_down, expired) so lab shells can guide learners.
- **FR-010**: System MUST implement recovery for failed provisioning or teardown — cleanup partial state and allow retry without manual operator intervention in normal cases.
- **FR-011**: System MUST emit structured audit events for session provision, failure, teardown, and expiry without logging learner SQL text.
- **FR-012**: System MUST integrate with existing dataset readiness gates so Experiment Runner blocks execution when the session's dataset is not ready — identical semantics to today but scoped per session.

### Key Entities

- **Experiment Session**: A disposable scope binding a lab visit to a runtime identity, Track, dataset configuration, lifecycle status, and correlation identifiers for audit.
- **Runtime Context**: The Track-specific disposable execution environment (Playground PostgreSQL schema scope for Database Track) where datasets and SQL experiments live for one session.
- **Session Identity Token**: An opaque identifier supplied or issued at lab entry that downstream APIs use to resolve the active runtime context.
- **Isolation Audit Event**: A structured record of provisioning, failure, teardown, or expiry with session identity, Track, outcome, and duration — no query text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In concurrent-session tests, 100% of cross-session contamination checks pass — mutations in session A never appear in session B.
- **SC-002**: 95% of Database Track session provisioning attempts complete within 10 seconds under normal platform load for 100K-tier labs.
- **SC-003**: 100% of automated new-session baseline tests confirm equivalent table structures and row counts to the documented dataset specification after successful provisioning.
- **SC-004**: Zero platform database tables store playground seed row data after isolation is enabled — verified by automated integration tests before and after multi-session workloads.
- **SC-005**: 100% of failed provisioning scenarios in test suites produce learner-facing categorized errors and allow a successful retry without operator intervention.
- **SC-006**: Session teardown reclaims 100% of session-scoped disposable objects in automated tests — no orphaned runtime namespaces after normal session close or expiry.

## Assumptions

- MVP implements Database Track isolation on Playground PostgreSQL only; Redis and other Track adapters follow the same session contract later.
- Authentication is not required for MVP session identity — a client session token (cookie or header) suffices until the Authentication feature integrates user-scoped sessions.
- Dataset Loader, Dataset Reset, and Experiment Runner are extended to accept session identity rather than replaced — isolation is a cross-cutting runtime concern.
- One active experiment session per client session identifier per lab is reused on repeat requests within the idle TTL window.
- Session metadata (identity, status, timestamps, lab reference) may be stored in Redis for MVP; durable platform persistence of session history is optional and out of scope unless required for audit retention policy.
- Physical per-session database instances are out of scope for MVP — schema-scoped isolation within shared Playground PostgreSQL is the expected implementation path documented in planning, not in this specification.
- Idle session TTL defaults to 60 minutes unless configured otherwise by platform operators.
- Worker Queue Foundation is not required for session provisioning at MVP — synchronous provisioning with async teardown is acceptable if teardown exceeds HTTP timeout thresholds.
