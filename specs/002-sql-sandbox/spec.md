# Feature Specification: SQL Sandbox & Resource Limits

**Feature Branch**: `002-sql-sandbox`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Enforce sandbox boundaries so only allowed SQL runs with bounded cost. Parameterized queries only; block dangerous statements. Per-query timeout and resource caps. Structured sandbox violation errors for learners."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-08

No clarification questions required. Spec completed with documented assumptions for timeout defaults (30s), row cap (10k), and MVP allowlist scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Safe SQL Execution Within Sandbox (Priority: P1)

A learner writes SQL in a Database Track lab and runs it against the playground database. The platform validates the statement, executes it within resource boundaries, and returns results or a clear educational error — never allowing statements that could harm platform data or exceed fair resource use.

**Why this priority**: Every Database Track experiment depends on safe SQL execution. Without sandbox enforcement, labs cannot run reliably or securely.

**Independent Test**: Submit allowed read-only and lab-permitted DDL/DML statements and verify execution succeeds with results. Submit blocked statements and verify rejection before execution with actionable messages.

**Acceptance Scenarios**:

1. **Given** a learner submits a parameterized `SELECT` against playground tables, **When** the sandbox validates and executes it, **Then** results are returned within the configured timeout.
2. **Given** a learner submits SQL containing string-concatenated user input (non-parameterized), **When** the sandbox validates it, **Then** execution is blocked with a sandbox violation explaining that only parameterized queries are allowed.
3. **Given** a learner submits a disallowed statement type (e.g., `DROP DATABASE`, `COPY TO PROGRAM`, extension install), **When** the sandbox validates it, **Then** execution is blocked before contacting the database with a categorized sandbox error.
4. **Given** a learner submits lab-permitted index DDL (e.g., `CREATE INDEX` on playground tables), **When** the sandbox validates it, **Then** execution proceeds within the same timeout and resource caps as other statements.

---

### User Story 2 - Resource Limits Protect Shared Playground (Priority: P1)

When a query runs too long or consumes excessive resources, the sandbox terminates it and returns a timeout or resource-limit error that helps the learner understand what happened — for example, that a sequential scan exceeded the time limit because no index was available.

**Why this priority**: Shared playground capacity must remain available for all learners. Unbounded queries would degrade the learning experience for everyone.

**Independent Test**: Run a deliberately slow or heavy query and verify it is terminated within the configured limit with an actionable, educational error message categorized as timeout or resource limit.

**Acceptance Scenarios**:

1. **Given** a query exceeds the per-query timeout, **When** the sandbox terminates it, **Then** the learner receives a timeout error with guidance relevant to the lab context (not a generic "query failed").
2. **Given** a query exceeds configured row-return or scan limits, **When** the sandbox enforces the cap, **Then** execution stops with a resource-limit error explaining the boundary that was hit.
3. **Given** multiple learners run queries concurrently, **When** each query respects sandbox limits, **Then** no single query can monopolize playground connections beyond configured per-query bounds.

---

### User Story 3 - Downstream Runners Consume Sandbox as Shared Guard (Priority: P2)

Experiment Runner, Explain Runner, and future queued SQL jobs invoke the same sandbox validation and limit enforcement so behavior is consistent whether SQL runs synchronously or via a worker.

**Why this priority**: A single sandbox layer prevents duplicated rules and inconsistent enforcement across execution paths. Lower priority than direct learner-facing validation because it depends on the core sandbox existing first.

**Independent Test**: Invoke the sandbox guard from a runner integration path and verify the same validation outcomes and error categories as direct submission.

**Acceptance Scenarios**:

1. **Given** Experiment Runner receives SQL for execution, **When** it delegates to the sandbox layer, **Then** validation, timeout, and error categorization match direct sandbox invocation.
2. **Given** Explain Runner receives an explain request, **When** it delegates to the sandbox layer, **Then** only safe explain variants are allowed and the same timeout applies.
3. **Given** a future queued SQL job, **When** the worker executes SQL, **Then** it uses the same sandbox contract without reimplementing rules.

---

### Edge Cases

- What happens when SQL is empty or whitespace only? Validation rejects with a clear validation error before execution.
- What happens when SQL contains multiple statements? Only single-statement execution is allowed unless the lab explicitly permits a defined multi-statement pattern; otherwise reject with sandbox violation.
- What happens when a learner uses comments or harmless formatting? Allowed statements with comments pass validation if the underlying operation is permitted.
- What happens when PostgreSQL returns its own error (syntax, missing table)? The sandbox passes through execution errors with educational wrapping where possible, distinct from sandbox policy violations.
- What happens when timeout fires mid-transaction? The sandbox rolls back or isolates the aborted operation so playground state is not left inconsistent for subsequent experiments (coordination with Dataset Reset is out of scope for this feature but errors must not corrupt shared schema).
- What happens for anonymous lab access? Sandbox rules apply identically; per-user rate limiting is delegated to the Per-User Rate Limit feature.
- What happens when configuration limits are missing at deploy time? Safe defaults apply so the playground never runs without timeout and resource caps.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a reusable SQL sandbox guard for Playground PostgreSQL used by all Database Track SQL execution paths.
- **FR-002**: System MUST allow only parameterized queries; string-concatenated dynamic SQL from user input MUST be rejected before execution.
- **FR-003**: System MUST block dangerous or out-of-scope statement classes including but not limited to: superuser operations, file system access (`COPY TO/FROM PROGRAM`), extension management, role/grant changes on platform objects, `DROP DATABASE`, and connections to external servers.
- **FR-004**: System MUST permit read queries (`SELECT`) and lab-scoped write/DDL operations on playground objects as defined by an allowlist (e.g., `CREATE INDEX`, `DROP INDEX` on playground tables) while blocking writes to platform or system catalogs.
- **FR-005**: System MUST enforce a configurable per-query timeout with a safe default suitable for interactive lab use.
- **FR-006**: System MUST enforce configurable resource caps (e.g., maximum rows returned, statement cost boundaries) with safe defaults.
- **FR-007**: System MUST categorize sandbox failures distinctly from validation, execution, and timeout errors per platform error taxonomy.
- **FR-008**: System MUST return learner-facing error messages that are actionable and educational per ENGINEERING_GUIDE error rules (e.g., timeout due to missing index, not "Query failed").
- **FR-009**: System MUST NOT implement per-user rate limiting in this feature; that responsibility belongs to Per-User Rate Limit.
- **FR-010**: System MUST NOT execute SQL against Platform DB; playground connection only.
- **FR-011**: System MUST expose sandbox configuration (timeouts, caps, allowlist policy version) to downstream runners without requiring duplicate parsing logic.
- **FR-012**: System MUST log sandbox violations with request correlation identifiers for troubleshooting without leaking sensitive query content in logs.

### Key Entities

- **Sandbox Policy**: Defines allowed statement types, blocked patterns, timeout default, resource cap defaults, and policy version for traceability.
- **Sandbox Validation Result**: Outcome of pre-execution checks — pass, validation error, or sandbox violation with category and educational message.
- **Sandbox Execution Context**: Playground connection scope, configured limits, and correlation metadata (request, lab, track) passed to runners.
- **Sandbox Violation**: Structured error record with category (`SANDBOX_VIOLATION`, `TIMEOUT`, `RESOURCE_LIMIT`), human-readable message, and optional hint for learners.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of known dangerous statement fixtures are blocked before database execution in automated tests.
- **SC-002**: 100% of parameterized allowed lab queries in the MVP test suite complete or fail with categorized errors within the configured timeout.
- **SC-003**: Learners receive sandbox violation messages that identify the policy violated (e.g., non-parameterized SQL, disallowed statement type) in under one screen of text without raw database internals.
- **SC-004**: A query configured to exceed the timeout is terminated and returns a response within 5 seconds of the limit boundary under normal load.
- **SC-005**: Experiment Runner and Explain Runner integration tests demonstrate identical sandbox outcomes for equivalent inputs without duplicated validation code paths.

## Assumptions

- Playground PostgreSQL is available as a separate database from Platform DB; connection configuration already exists or will be provided by infrastructure setup.
- MVP labs require `SELECT`, `EXPLAIN` / `EXPLAIN ANALYZE`, and index-related DDL on playground tables; broader DDL (e.g., `CREATE TABLE`) is out of scope unless a specific lab requires it later.
- Default per-query timeout is 30 seconds for interactive labs unless overridden by environment configuration.
- Default maximum rows returned is 10,000 rows unless a lab declares a lower cap.
- SQL parsing/validation may use a conservative allowlist/blocklist approach; perfect SQL grammar coverage is not required if dangerous classes are reliably blocked.
- Per-user rate limiting, authentication enforcement, and dataset loading are separate features that integrate with but do not block delivery of the core sandbox guard.
- Anonymous lab access may exist; sandbox rules apply uniformly regardless of auth state.

## Out of Scope

- Per-user or global rate limiting (Per-User Rate Limit feature)
- Dataset loading, reset, or session isolation (Dataset Loader, Dataset Reset, Experiment Isolation)
- HTTP API endpoints for running SQL (Experiment Runner feature)
- Queue-based execution (SQL Execution Queue feature)
- Redis or non-PostgreSQL runtime sandboxes (future Track adapters)
