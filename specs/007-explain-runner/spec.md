# Feature Specification: Explain Runner

**Feature Branch**: `007-explain-runner`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Run EXPLAIN / EXPLAIN ANALYZE safely and return planner output for visualization. Execute explain commands within sandbox limits. Parse execution tree, cost, rows, planning time, execution time. Return backend-normalized explain payload (never raw-only strings to UI). Safe execution without side effects on platform data."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner Inspects a Query Plan (Priority: P1)

A learner in a Database Track lab submits SQL and requests an execution plan. The platform verifies the lab's dataset is ready, runs `EXPLAIN` or `EXPLAIN ANALYZE` safely within sandbox limits, and returns a structured plan the lab can visualize — node tree, costs, row estimates, scan types, and timing — so the learner can understand how PostgreSQL would execute (or did execute) their query.

**Why this priority**: Inspecting query plans is the core learning interaction for EXPLAIN Analyze and Index labs. Without a reliable explain path, learners cannot observe planner behavior.

**Independent Test**: Prepare a commerce dataset to ready state, submit a parameterized `SELECT` with explain mode, and verify a structured plan payload is returned with tree nodes, cost, and row fields within acceptable latency.

**Acceptance Scenarios**:

1. **Given** a lab's dataset is in ready state, **When** the learner requests `EXPLAIN` for a valid parameterized `SELECT`, **Then** the platform returns a structured plan with node tree, estimated cost, and estimated rows without executing the query's data-producing side effects beyond planner inspection.
2. **Given** a lab's dataset is in ready state, **When** the learner requests `EXPLAIN ANALYZE` for a valid parameterized `SELECT`, **Then** the platform returns a structured plan including actual execution time, planning time, actual rows, and loop counts where available.
3. **Given** a lab's dataset is still preparing or resetting, **When** the learner attempts an explain request, **Then** execution is blocked with a clear not-ready message before any explain command reaches the database.
4. **Given** a learner submits explain for SQL with bound parameters, **When** explain succeeds, **Then** the plan reflects the parameter values and is repeatable for the same input against an unchanged playground state.

---

### User Story 2 - Learner Receives Actionable Explain Errors (Priority: P1)

When an explain request fails — due to sandbox policy, timeout, syntax error, unsupported explain variant, or dataset-not-ready — the learner receives an educational, categorized error that explains what went wrong and, where possible, what to try next. Errors distinguish platform policy violations from database execution failures from dataset-not-ready conditions.

**Why this priority**: EXPLAIN labs teach diagnosis skills; opaque failures undermine the educational purpose.

**Independent Test**: Submit explain requests that trigger each major error category (sandbox violation, timeout, syntax error, dataset not ready, unsupported mode) and verify each response includes a human-readable message, error category, and optional hint.

**Acceptance Scenarios**:

1. **Given** a learner submits a disallowed statement or explain variant, **When** the platform rejects it, **Then** the response categorizes the failure as a sandbox policy violation with an actionable explanation before harmful execution occurs.
2. **Given** an explain operation exceeds the configured timeout, **When** execution is terminated, **Then** the learner receives a timeout error with Database Track guidance (e.g., suggesting simpler query or index exploration).
3. **Given** a learner submits SQL with a syntax error, **When** the database rejects the explain, **Then** the response passes through the database error with educational wrapping, categorized distinctly from sandbox policy violations.
4. **Given** a learner requests an explain mode not supported by the platform (e.g., raw-only passthrough without structure), **When** validation runs, **Then** the response explains supported modes clearly.

---

### User Story 3 - Explain Stays Isolated to the Playground (Priority: P1)

Every explain execution runs exclusively against Playground PostgreSQL. Platform data is never read or modified by explain operations. `EXPLAIN ANALYZE` executes the query for measurement but changes remain confined to the playground runtime — never the platform database.

**Why this priority**: Platform/playground separation is constitutional. Explain must not become a bypass for platform access.

**Independent Test**: Execute representative explain requests and verify platform database state is unchanged. Confirm explain never uses the platform database connection.

**Acceptance Scenarios**:

1. **Given** a learner runs any allowed explain request, **When** processing completes, **Then** platform database records remain unchanged.
2. **Given** an explain request is submitted, **When** the runner processes it, **Then** only the playground runtime is used — never the platform database.
3. **Given** `EXPLAIN ANALYZE` modifies transient playground state (e.g., buffer cache effects), **When** explain completes, **Then** no platform schema or permanent records are affected.

---

### User Story 4 - Structured Plan Output for Visualization (Priority: P1)

The lab shell receives a backend-normalized explain payload suitable for tree, cost, and timing visualizations — not a raw text plan string alone. The payload includes a hierarchical node tree and summary metrics so the frontend renders plans without parsing database-specific text formats.

**Why this priority**: Constitution requires backend-sourced metrics and structured contracts. Raw-only plan text forces frontend parsing and violates learning-first architecture.

**Independent Test**: Run explain against queries producing sequential scan, index scan, and nested loop nodes; verify each returns a structured tree with typed nodes and summary fields consumable without text parsing.

**Acceptance Scenarios**:

1. **Given** a query plan contains multiple nodes (e.g., Seq Scan, Hash Join), **When** explain completes, **Then** the response includes a hierarchical node tree with node type, relation name, cost range, and row estimates or actuals per node.
2. **Given** `EXPLAIN ANALYZE` completes, **When** results are returned, **Then** summary fields include planning time and execution time in addition to the node tree.
3. **Given** a plan is returned, **When** the lab shell renders it, **Then** no additional backend-specific text parsing is required beyond consuming the structured payload.
4. **Given** the database returns verbose plan details, **When** the runner normalizes output, **Then** the payload preserves learner-relevant fields (scan type, index name, filter conditions, sort method) without exposing internal-only noise.

---

### User Story 5 - Lab Context and Session Scope Travel With Explain (Priority: P2)

The lab shell identifies which track, lab, dataset, and optional experiment session an explain belongs to. The runner accepts this context for readiness checks, schema scoping, logging, and future metrics attribution — without requiring the learner to manage runtime details.

**Why this priority**: Context attribution improves observability and session isolation but basic explain can work with dataset identity alone once readiness is enforced.

**Independent Test**: Submit explain requests with track, lab, dataset, and session identifiers; verify responses and audit logs include supplied context and session-scoped queries run against the correct playground schema.

**Acceptance Scenarios**:

1. **Given** a lab shell submits explain with track and lab identifiers, **When** explain completes, **Then** the response is associated with that lab context for logging and error attribution.
2. **Given** an experiment session is provisioned, **When** explain includes a session identifier, **Then** the plan reflects SQL executed against that session's isolated playground schema.
3. **Given** no session identifier is provided, **When** explain runs against a ready shared dataset, **Then** behavior remains backward compatible with existing dataset-scoped playground access.

---

### User Story 6 - Explain Outcomes Are Auditable (Priority: P2)

Platform operators can review structured explain events — start, success, failure — with timing, explain mode, error category, and lab context. Audit records support troubleshooting without logging full SQL text or parameter values in production.

**Why this priority**: Operational visibility supports reliability but is secondary to learner-facing explain correctness.

**Independent Test**: Trigger successful and failed explain requests and verify structured audit events are emitted with required fields and without sensitive SQL content.

**Acceptance Scenarios**:

1. **Given** an explain request starts, **When** processing begins, **Then** a structured audit event records the start with lab context, explain mode, and correlation identifier.
2. **Given** explain completes successfully, **When** results are returned, **Then** a completion audit event records duration and plan summary (node count, top-level scan type) without full plan payloads.
3. **Given** explain fails, **When** the error is returned, **Then** a failure audit event records error category without logging full SQL or parameter values.

---

### Edge Cases

- What happens when the playground dataset was never prepared? Explain is blocked with a not-ready error directing the learner or lab shell to prepare the dataset first.
- What happens when dataset status is `preparing` or `resetting`? Explain is blocked with a status-specific message; the learner is not left waiting on a hung operation.
- What happens when a learner requests `EXPLAIN` for a write statement disallowed by sandbox policy? The request is rejected with a sandbox violation before execution, consistent with Experiment Runner behavior.
- What happens when `EXPLAIN ANALYZE` runs a query that modifies playground data (e.g., permitted `CREATE INDEX`)? The plan is returned and playground state reflects the change until dataset reset; platform data remains untouched.
- What happens when the plan is extremely large (deeply nested join tree)? The runner returns a structured tree within configured size limits or truncates with an explicit flag so the lab shell can warn the learner.
- What happens when multiple statements are submitted? Only single-statement explain is allowed; otherwise reject with a clear validation error.
- What happens when explain is requested for empty or whitespace SQL? Validation rejects with a clear validation error before execution.
- What happens when the playground connection pool is exhausted? The learner receives a clear temporary-unavailability error with retry guidance.
- What happens for anonymous lab access where permitted? Explain rules and sandbox limits apply identically; identity attribution falls back to session context.
- What happens when PostgreSQL returns a plan format edge case (e.g., subplan, initplan, CTE)? The structured payload represents nested nodes faithfully or marks unsupported node details without failing the entire request when the top-level plan is valid.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a lab-facing path for submitting explain requests (`EXPLAIN` and `EXPLAIN ANALYZE`) against Playground PostgreSQL only.
- **FR-002**: System MUST verify dataset readiness (`ready`) for the lab's configured dataset family, tier, and version before executing any explain operation.
- **FR-003**: System MUST delegate SQL validation, timeout enforcement, and resource limits to the existing SQL Sandbox layer without duplicating sandbox rules.
- **FR-004**: System MUST return a backend-normalized structured explain payload on success, including a hierarchical plan node tree and summary metrics — never raw plan text as the sole response field.
- **FR-005**: System MUST include per-node fields sufficient for Database Track visualization: node type, estimated cost, estimated rows, actual rows and loops (when `EXPLAIN ANALYZE`), relation or index name where applicable, and filter or sort details when present in the plan.
- **FR-006**: System MUST include summary timing fields for `EXPLAIN ANALYZE` results: planning time and total execution time.
- **FR-007**: System MUST return structured, categorized errors distinguishing validation errors, sandbox policy violations, timeouts, dataset-not-ready conditions, and database execution errors.
- **FR-008**: System MUST include educational, actionable error messages aligned with Database Track learning goals.
- **FR-009**: System MUST accept optional lab context (track, lab, dataset identity, session identifier, correlation identifier) with every explain request.
- **FR-010**: System MUST block explain when dataset status is `preparing`, `resetting`, or otherwise not ready.
- **FR-011**: System MUST never route explain operations to the platform database.
- **FR-012**: System MUST emit structured audit events for explain start, success, and failure without logging full SQL text or parameter values in production.
- **FR-013**: System MUST support the same allowed underlying SQL statement types as Experiment Runner for the Database Track MVP allowlist when wrapped in explain.
- **FR-014**: System MUST reject explain requests that attempt disallowed sandbox operations even when prefixed with `EXPLAIN` or `EXPLAIN ANALYZE`.
- **FR-015**: System MUST return deterministic, repeatable plan structure for identical SQL, parameters, explain mode, and unchanged playground state.
- **FR-016**: System MUST scope explain execution to an experiment session's isolated playground schema when a valid session identifier is supplied.
- **FR-017**: System MUST preserve backward compatibility for explain requests without a session identifier against shared dataset-scoped playground access.

### Key Entities

- **Explain Request**: A learner's submitted SQL with bound parameters, explain mode (`explain` or `explain_analyze`), lab context, optional session identifier, and target dataset identity.
- **Explain Plan Node**: A single node in the hierarchical execution plan with type, cost, row estimates or actuals, child nodes, and optional relation, index, filter, or sort metadata.
- **Explain Result**: Structured success payload with plan tree, summary timing, explain mode, and dataset identity returned to the lab shell.
- **Explain Error**: Categorized failure response with error code, human-readable message, optional hint, and correlation metadata.
- **Dataset Readiness Gate**: Pre-execution check confirming the playground dataset for the requested identity is in ready state before explain runs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Learners receive structured explain results for valid parameterized `SELECT` statements within 30 seconds for 100K-tier datasets under normal load (`EXPLAIN`) and within configured sandbox timeout for `EXPLAIN ANALYZE`.
- **SC-002**: 100% of explain attempts against non-ready datasets are blocked before any explain command reaches the database, with a clear not-ready message.
- **SC-003**: 100% of disallowed statement types are rejected with categorized sandbox errors before database execution, matching Experiment Runner sandbox behavior for equivalent underlying SQL.
- **SC-004**: 100% of successful explain responses include a structured node tree — not raw text alone — verified across sequential scan, index scan, and join plan integration scenarios.
- **SC-005**: Learners encountering timeout, syntax, or policy errors receive messages that identify the error category without requiring support intervention in at least 90% of common lab failure scenarios (measured via integration test matrix).
- **SC-006**: Zero explain executions modify platform database state across the full integration test suite.
- **SC-007**: Audit events for every explain request include lab context, explain mode, duration, outcome category, and correlation identifier without exposing full SQL or parameter values.
- **SC-008**: When a valid experiment session identifier is supplied, 100% of explain operations execute against that session's schema and not another session's schema in concurrent-session integration tests.

## Assumptions

- SQL Sandbox & Resource Limits (002) is complete and provides the internal validation contract; explain-specific allow rules extend the sandbox without duplicating core enforcement.
- Dataset Loader (003) and Dataset Reset (004) are complete; explain uses the same dataset readiness gate as Experiment Runner.
- Experiment Runner (005) is complete and establishes patterns for lab context, error categorization, and sandbox delegation that Explain Runner follows.
- Experiment Isolation (006) is complete; optional session identifiers scope explain to session-specific playground schemas.
- MVP scope is synchronous explain execution only; async queue-based explain is deferred to SQL Execution Queue.
- Metric Contract normalization, comparison history, and cross-run aggregation are deferred to Metrics Pipeline; this feature returns structured plan data and summary timing only.
- Frontend tree/cost/scan visualizations consume the structured payload; this feature does not deliver UI components.
- Per-user rate limiting for explain operations is delegated to Per-User Rate Limit; global safety limits may still apply as a backstop.
- Authentication is optional for MVP lab access where the platform already permits anonymous sessions.
- Supported explain modes for MVP are `EXPLAIN` and `EXPLAIN ANALYZE` only; formats like `EXPLAIN (FORMAT JSON)` are internal implementation choices, not learner-facing options.
- Raw plan text may be included as supplementary diagnostic detail for support but MUST NOT be the only machine-consumable output field.
