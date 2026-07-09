# Feature Specification: Experiment Runner

**Feature Branch**: `005-experiment-runner`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Execute user SQL safely inside the PostgreSQL Runtime Adapter and return structured execution results. Run parameterized SQL against Playground PostgreSQL only. Enforce query timeout and resource limits. Return rows, timing, and error details with actionable messages. Deterministic, repeatable execution per experiment rules."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-08

No clarification questions required. Spec completed with documented assumptions for synchronous MVP execution, dataset readiness gating, sandbox delegation, and explicit scope boundaries vs Explain Runner, SQL Execution Queue, and Metrics Pipeline.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner Runs SQL in a Lab and Sees Results (Priority: P1)

A learner writes SQL in a Database Track lab and submits it to run against the playground dataset. The platform verifies the lab's dataset is ready, executes the query safely within resource limits, and returns structured results — row data, row count, execution time, and column metadata — so the learner can inspect query output and continue the lesson.

**Why this priority**: Running SQL and seeing results is the core interaction for every Database Track experiment. Without a reliable execution path, no SQL lab can function.

**Independent Test**: Prepare a commerce dataset to ready state, submit a parameterized `SELECT`, and verify structured results including rows, timing, and column fields are returned within acceptable latency.

**Acceptance Scenarios**:

1. **Given** a lab's dataset is in ready state, **When** the learner submits a valid parameterized `SELECT`, **Then** the platform returns row data, row count, execution time, and column metadata within the configured timeout.
2. **Given** a lab's dataset is still preparing or resetting, **When** the learner attempts to run SQL, **Then** execution is blocked with a clear not-ready message explaining that the dataset must finish loading before queries can run.
3. **Given** a learner submits SQL with bound parameters, **When** execution succeeds, **Then** results reflect the parameter values correctly and execution is repeatable for the same input against an unchanged playground state.
4. **Given** a learner submits lab-permitted statements (e.g., `CREATE INDEX` on playground tables), **When** execution completes, **Then** results or affected-row feedback are returned using the same structured execution contract as read queries.

---

### User Story 2 - Learner Receives Actionable Errors Instead of Opaque Failures (Priority: P1)

When SQL fails — due to sandbox policy, timeout, syntax error, or missing table — the learner receives an educational, categorized error that explains what went wrong and, where possible, what to try next. Errors distinguish platform policy violations from database execution failures from dataset-not-ready conditions.

**Why this priority**: Learning-first UX requires errors that teach, not frustrate. Opaque failures undermine the educational purpose of every lab.

**Independent Test**: Submit SQL that triggers each major error category (sandbox violation, timeout, syntax error, dataset not ready) and verify each response includes a human-readable message, error category, and optional hint relevant to the lab context.

**Acceptance Scenarios**:

1. **Given** a learner submits a disallowed statement type, **When** the platform rejects it, **Then** the response categorizes the failure as a sandbox policy violation with an actionable explanation before any database side effects occur.
2. **Given** a query exceeds the configured timeout, **When** execution is terminated, **Then** the learner receives a timeout error with guidance relevant to Database Track context (e.g., suggesting index or query refinement where appropriate).
3. **Given** a learner submits SQL with a syntax error, **When** the database rejects it, **Then** the response passes through the database error with educational wrapping, categorized distinctly from sandbox policy violations.
4. **Given** a learner submits empty or malformed input, **When** validation runs, **Then** the response explains the input problem clearly without attempting execution.

---

### User Story 3 - Execution Stays Isolated to the Playground (Priority: P1)

Every experiment execution runs exclusively against Playground PostgreSQL. Platform data — user accounts, progress, lab definitions, and permanent records — is never read or modified by experiment SQL. The runner enforces this boundary as a non-negotiable safety property.

**Why this priority**: Platform/playground separation is a constitutional requirement. A single misrouted query could compromise platform integrity and destroy learner trust.

**Independent Test**: Execute representative allowed SQL and verify platform database state is unchanged. Attempt execution paths and confirm no platform database connection is used for user SQL.

**Acceptance Scenarios**:

1. **Given** a learner runs any allowed SQL experiment, **When** execution completes, **Then** platform database records remain unchanged.
2. **Given** experiment execution is requested, **When** the runner processes it, **Then** only the playground runtime is used for SQL execution — never the platform database.
3. **Given** a learner runs DDL permitted by the sandbox (e.g., index creation), **When** execution completes, **Then** changes exist only in the playground and do not affect platform schema or data.

---

### User Story 4 - Lab Context Travels With Every Execution (Priority: P2)

The lab shell identifies which track, lab, and dataset configuration an execution belongs to. The runner accepts this context so errors, logging, and future metrics can be attributed correctly — enabling support troubleshooting and consistent behavior across labs without the learner managing runtime details.

**Why this priority**: Context attribution improves observability and enables track-aware error messages, but basic SQL execution can work with minimal context once dataset readiness is enforced.

**Independent Test**: Submit executions with track and lab identifiers and verify responses and audit logs include the supplied context without requiring the learner to specify database connection details.

**Acceptance Scenarios**:

1. **Given** a lab shell submits SQL with track and lab identifiers, **When** execution completes, **Then** the response is associated with that lab context for logging and error attribution.
2. **Given** a lab references a specific dataset family, tier, and version, **When** execution is requested, **Then** the runner verifies readiness for that dataset identity before executing.
3. **Given** optional request correlation identifiers are provided, **When** an error occurs, **Then** support staff can trace the failure using the correlation identifier without exposing sensitive SQL content in learner-facing messages.

---

### User Story 5 - Execution Outcomes Are Auditable (Priority: P2)

Platform operators and support staff can review structured execution events — start, success, failure — with timing, error category, and lab context. Audit records support troubleshooting without logging full SQL text or parameter values in production.

**Why this priority**: Operational visibility supports reliability at scale but is secondary to learner-facing execution correctness.

**Independent Test**: Trigger successful and failed executions and verify structured audit events are emitted with required fields and without sensitive SQL content.

**Acceptance Scenarios**:

1. **Given** an execution starts, **When** processing begins, **Then** a structured audit event records the start with lab context and correlation identifier.
2. **Given** an execution completes successfully, **When** results are returned, **Then** a completion audit event records duration and row count summary (not full row payloads).
3. **Given** an execution fails, **When** the error is returned, **Then** a failure audit event records error category and violation code without logging full SQL or parameter values.

---

### Edge Cases

- What happens when the playground dataset was never prepared for the lab? Execution is blocked with a not-ready error directing the learner or lab shell to prepare the dataset first.
- What happens when dataset status is `preparing` or `resetting`? Execution is blocked with a status-specific message; the learner is not left waiting on a hung query.
- What happens when SQL returns more rows than the configured cap? Results are truncated with an explicit truncated flag so the learner knows the full result set was not returned.
- What happens when multiple statements are submitted? Only single-statement execution is allowed unless the lab explicitly permits a defined pattern; otherwise reject with a clear validation error.
- What happens when a learner runs SQL concurrently from the same session? Each request is handled independently; deduplication and queue-based execution are delegated to the SQL Execution Queue feature.
- What happens when the playground connection pool is exhausted? The learner receives a clear temporary-unavailability error with retry guidance rather than an internal server error.
- What happens for anonymous or unauthenticated lab access where permitted? Execution rules and sandbox limits apply identically; identity attribution falls back to session context where authentication is absent.
- What happens when a query succeeds but modifies playground state (e.g., index creation)? Subsequent queries in the same session see the modified playground state until dataset reset restores baseline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a lab-facing execution path for submitting parameterized SQL against Playground PostgreSQL only.
- **FR-002**: System MUST verify dataset readiness (`ready`) for the lab's configured dataset family, tier, and version before executing any SQL.
- **FR-003**: System MUST delegate all SQL validation, timeout enforcement, and resource limits to the existing SQL Sandbox layer without duplicating sandbox rules.
- **FR-004**: System MUST return structured execution results on success including row data, row count, execution time, truncation indicator, and column metadata.
- **FR-005**: System MUST return structured, categorized errors on failure distinguishing validation errors, sandbox policy violations, timeouts, dataset-not-ready conditions, and database execution errors.
- **FR-006**: System MUST include educational, actionable error messages aligned with Database Track learning goals per ENGINEERING_GUIDE error guidelines.
- **FR-007**: System MUST accept optional lab context (track, lab, dataset identity, correlation identifier) with every execution request for attribution and readiness checks.
- **FR-008**: System MUST block execution when dataset status is `preparing`, `resetting`, or otherwise not ready, returning a status-specific not-ready response.
- **FR-009**: System MUST never route user SQL to the platform database.
- **FR-010**: System MUST emit structured audit events for execution start, success, and failure without logging full SQL text or parameter values in production.
- **FR-011**: System MUST support the same allowed statement types as the SQL Sandbox MVP allowlist for Database Track labs.
- **FR-012**: System MUST return deterministic, repeatable results for identical SQL and parameters against an unchanged playground state.

### Key Entities

- **Experiment Execution Request**: A learner's submitted SQL with bound parameters, lab context, and target dataset identity used to orchestrate a single run.
- **Experiment Execution Result**: Structured success payload with rows, counts, timing, truncation flag, and column metadata returned to the lab shell.
- **Experiment Execution Error**: Categorized failure response with error code, human-readable message, optional hint, and correlation metadata for support.
- **Dataset Readiness Gate**: Pre-execution check that confirms the playground dataset for the requested identity is in ready state before SQL runs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Learners receive structured query results for valid parameterized `SELECT` statements within 30 seconds for 100K-tier datasets under normal load.
- **SC-002**: 100% of execution attempts against non-ready datasets are blocked before SQL reaches the database, with a clear not-ready message.
- **SC-003**: 100% of disallowed statement types are rejected with categorized sandbox errors before database execution, matching direct sandbox behavior for equivalent inputs.
- **SC-004**: Learners encountering timeout, syntax, or policy errors receive messages that identify the error category without requiring support intervention in at least 90% of common lab failure scenarios (measured via integration test matrix).
- **SC-005**: Zero experiment executions modify platform database state across the full integration test suite.
- **SC-006**: Audit events for every execution include lab context, duration, outcome category, and correlation identifier without exposing full SQL or parameter values.

## Assumptions

- SQL Sandbox & Resource Limits (002) is complete and provides the internal validation and execution contract consumed by this feature.
- Dataset Loader (003) is complete and exposes dataset metadata and readiness status used for pre-execution gating.
- Dataset Reset (004) is complete; executions during `resetting` status are blocked the same as `preparing`.
- MVP scope is synchronous execution only; async queue-based execution is deferred to SQL Execution Queue.
- EXPLAIN and EXPLAIN ANALYZE execution paths are deferred to Explain Runner; Experiment Runner handles general SQL execution only.
- Metric Contract normalization and persistence are deferred to Metrics Pipeline; this feature returns raw execution timing and row counts only.
- Per-user rate limiting is delegated to Per-User Rate Limit; global safety limits may still apply as a backstop.
- Authentication is optional for MVP lab access where the platform already permits anonymous sessions; authenticated user identity is included in context when available.
- A lower-level sandbox HTTP endpoint may exist for development; Experiment Runner is the lab-orchestrated production path that enforces dataset readiness and lab context.
- Experiment Isolation session scoping is a separate feature; MVP relies on shared playground with dataset reset for state recovery.
