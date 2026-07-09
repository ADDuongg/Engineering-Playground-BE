# Feature Specification: Redis Sandbox Runtime

**Feature Branch**: `018-redis-sandbox-runtime`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Provide the Playground Redis Runtime Adapter for Redis Track labs (ROADMAP §Redis Track). Deliverables: isolated Redis instance per experiment session; cache operation execution with timeout and resource limits; Metric Contract output (cache hit ratio, latency, key count, memory usage); Input Surface metadata for FE Redis command / config panel; no dependency on Playground PostgreSQL for cache operations."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Execute Cache Operations in an Isolated Session (Priority: P1)

A learner in a Redis Track lab runs cache operations (get, set, delete, and related lab-permitted commands) against a disposable playground cache runtime. Each experiment session uses an isolated cache namespace so one learner’s keys and values never affect another learner’s session or any platform data.

**Why this priority**: Without a safe, isolated place to run cache operations, no Redis Track lab can teach caching through experimentation.

**Independent Test**: Open two separate experiment sessions; write distinct keys in each; verify each session only sees its own keys; confirm platform permanent data is untouched.

**Acceptance Scenarios**:

1. **Given** an authenticated learner starts a Redis Track experiment session, **When** they execute a permitted cache write then read for the same key, **Then** the read returns the value they wrote and the response includes measured operation latency.
2. **Given** two concurrent experiment sessions for the same or different users, **When** each writes the same logical key name with different values, **Then** each session reads only its own value (full isolation).
3. **Given** a learner’s experiment session ends or is reset, **When** a new session starts for that learner, **Then** prior session keys are not visible (disposable runtime state).
4. **Given** a cache operation request, **When** it is executed, **Then** it MUST NOT read from or write to Playground PostgreSQL or Platform permanent storage for cache data.

---

### User Story 2 - Enforce Timeouts and Resource Limits (Priority: P1)

When a cache operation runs too long or exceeds fair-use resource bounds (payload size, key count, memory pressure within the session), the sandbox terminates or rejects the operation and returns a clear, educational error so the learner understands the boundary—not a generic failure.

**Why this priority**: Shared playground capacity and fair multi-tenant use require the same class of guardrails as the SQL sandbox.

**Independent Test**: Submit an operation that exceeds configured timeout or size/key caps; verify categorized timeout or resource-limit errors with actionable learner messaging.

**Acceptance Scenarios**:

1. **Given** a cache operation exceeds the configured per-operation timeout, **When** the sandbox terminates it, **Then** the learner receives a timeout error with guidance relevant to cache/lab context.
2. **Given** a write whose value or key size exceeds the configured payload limit, **When** the sandbox validates it, **Then** execution is blocked or stopped with a resource-limit error explaining the bound.
3. **Given** a session approaches or exceeds the configured key-count or memory cap, **When** further writes would breach the cap, **Then** the sandbox rejects the write with a resource-limit error rather than allowing unbounded growth.
4. **Given** missing deploy-time limit configuration, **When** the sandbox starts, **Then** safe defaults apply so the runtime never runs without timeout and resource caps.

---

### User Story 3 - Return Cache Metrics in the Shared Metric Contract (Priority: P1)

After cache operations (or a lab-defined measurement window), the platform returns metrics using the shared Metric Contract so the frontend can chart cache behavior without computing engineering metrics itself. Required Redis Track metrics include cache hit ratio, operation latency, key count, and memory usage.

**Why this priority**: Learning-first UX and constitution require backend-owned metrics; Redis labs cannot teach hit/miss or memory impact without them.

**Independent Test**: Run a sequence of hits and misses; request metrics for the session; verify hit ratio, latency, key count, and memory usage appear with correct units/groups and match observed operations within expected tolerance.

**Acceptance Scenarios**:

1. **Given** a session that performed known hits and misses, **When** metrics are requested or returned with the experiment result, **Then** cache hit ratio is present as a Metric Contract entry (numeric value with label, unit, and cache-related group).
2. **Given** one or more completed cache operations, **When** metrics are returned, **Then** operation latency is present (e.g., last or aggregate latency as defined for the lab measurement window).
3. **Given** keys exist in the session, **When** metrics are returned, **Then** key count and memory usage are present and non-negative.
4. **Given** the frontend receives metrics, **When** it renders charts, **Then** it does not need to recompute hit ratio or latency from raw command logs (backend is the source of truth).

---

### User Story 4 - Expose Input Surface Metadata for Redis Labs (Priority: P2)

The frontend needs metadata describing how learners interact with Redis Track labs (allowed command categories, config panel fields, limits, and help text) so it can render a command/config panel without hard-coding Track-specific rules.

**Why this priority**: Enables FE discovery of Redis Input Surface; secondary to execution, limits, and metrics which unblock learning experiments.

**Independent Test**: Request Input Surface metadata for the Redis Track (or a Redis lab); verify allowed operation categories, limit summaries, and panel field descriptors are returned without requiring FE to know sandbox internals.

**Acceptance Scenarios**:

1. **Given** a Redis Track lab is available in the catalog, **When** the client requests Input Surface metadata for that Track/lab, **Then** it receives descriptors for the Redis command/config panel (allowed operation categories, parameter fields, and human-readable labels).
2. **Given** sandbox limits are configured, **When** metadata is returned, **Then** timeout and resource-cap summaries suitable for display are included (or referenced) so learners see fair-use bounds.
3. **Given** a non-Redis Track, **When** Redis Input Surface metadata is requested for it, **Then** the system returns a clear not-applicable / not-found response rather than Redis-specific metadata.

---

### User Story 5 - Block Dangerous or Out-of-Scope Cache Commands (Priority: P2)

Learners must not run administrative or destructive commands that escape the lab sandbox (e.g., flush all shared data, change server config, script abuse beyond lab policy). Disallowed operations are rejected before execution with categorized sandbox violations.

**Why this priority**: Security and multi-tenant safety; slightly lower than core execute/metrics because the allowlist can start narrow for MVP labs and expand.

**Independent Test**: Submit known blocked command classes; verify rejection before execution with educational sandbox-violation messages; submit allowlisted lab commands and verify success.

**Acceptance Scenarios**:

1. **Given** a learner submits a disallowed administrative command (e.g., server-wide flush, config rewrite, unrestricted scripting), **When** the sandbox validates it, **Then** execution is blocked with a categorized sandbox violation and an actionable message.
2. **Given** a learner submits a lab-permitted command (get/set/delete and other allowlisted cache operations), **When** the sandbox validates it, **Then** execution proceeds within timeout and resource caps.
3. **Given** empty or malformed command input, **When** validation runs, **Then** the system rejects with a clear validation error before contacting the cache runtime.

---

### Edge Cases

- What happens when the session id is missing or unknown? Reject with a clear validation / not-found error; do not create an implicit shared namespace.
- What happens when the cache runtime is temporarily unavailable? Return a categorized infrastructure error with a learner-safe message; do not fall back to PostgreSQL.
- What happens on concurrent operations within one session? Operations are serialized or safely concurrent per session policy; metrics remain consistent (no torn hit/miss counters).
- What happens when a key expires (TTL)? Subsequent gets count as misses; metrics reflect post-expiry state.
- What happens for anonymous access? If Redis Track labs require auth (assumed for MVP), unauthenticated callers are rejected; sandbox rules still apply uniformly when auth is present.
- What happens when Platform Redis (queues/cache for the app) is the same infrastructure class? Playground Redis sessions MUST remain logically isolated from platform queue/cache keys; platform workers MUST NOT read learner session keys.
- What happens when configuration limits are missing? Safe defaults apply (see Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Playground Redis Runtime Adapter that executes Redis Track cache experiments without using Playground PostgreSQL for cache data or cache metrics collection.
- **FR-002**: System MUST isolate experiment session state so keys and values in one session are not visible to other sessions (logical or physical isolation).
- **FR-003**: System MUST support lab-permitted cache operations needed for Redis Track MVP labs (at minimum: get, set, delete; additional allowlisted commands as required by seeded labs).
- **FR-004**: System MUST enforce a configurable per-operation timeout with a safe default suitable for interactive labs.
- **FR-005**: System MUST enforce configurable resource caps including maximum value/key payload size, maximum keys per session, and a session memory bound, with safe defaults.
- **FR-006**: System MUST block dangerous or out-of-scope command classes (server admin, cross-session flush, config mutation, unrestricted scripting) before execution.
- **FR-007**: System MUST categorize failures distinctly among validation errors, sandbox violations, timeouts, resource limits, and runtime/infrastructure errors.
- **FR-008**: System MUST return learner-facing error messages that are actionable and educational (Track-aware), not opaque generic failures.
- **FR-009**: System MUST emit or expose metrics using the shared Metric Contract for at least: cache hit ratio, operation latency, key count, and memory usage.
- **FR-010**: System MUST expose Input Surface metadata for Redis Track labs describing allowed operation categories, config panel fields, and limit summaries for FE rendering.
- **FR-011**: System MUST keep playground session state disposable and resettable per experiment session (aligned with DOMAIN Runtime Adapter rules).
- **FR-012**: System MUST NOT mix playground session keys with platform infrastructure keys (queues, app cache, rate-limit stores).
- **FR-013**: System MUST require authentication for Redis sandbox execution and metadata endpoints in MVP (consistent with other learning APIs that mutate or observe user experiment state).
- **FR-014**: System MUST log sandbox violations and runtime failures with request correlation identifiers without logging secret values or large payloads in full.
- **FR-015**: System MUST NOT implement Redis Track lab content (Cache Aside, Write Through, etc.), quizzes, or FE charts in this feature—only the runtime adapter, limits, metrics, and Input Surface metadata.

### Key Entities

- **Redis Experiment Session**: Disposable isolated cache context bound to a learner experiment; owns keys, counters for hits/misses, and resource usage.
- **Sandbox Policy**: Allowlisted command categories, blocked classes, timeout default, payload/key/memory caps, and policy version.
- **Cache Operation Request**: Learner-submitted operation (command category, key, optional value/TTL/args) within a session.
- **Cache Operation Result**: Success/failure outcome, returned value when applicable, latency, and categorized error when failed.
- **Metric Snapshot (Redis)**: Metric Contract entries for hit ratio, latency, key count, and memory usage for a session or measurement window.
- **Input Surface Descriptor**: Metadata for FE Redis command/config panel (fields, allowed categories, displayed limits, help copy references).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated isolation tests, 100% of cross-session key probes fail to read another session’s values.
- **SC-002**: 100% of known dangerous/disallowed command fixtures are blocked before runtime execution in automated tests.
- **SC-003**: An operation configured to exceed the timeout is terminated and returns a categorized timeout response within 5 seconds of the limit boundary under normal load.
- **SC-004**: After a scripted mix of hits and misses, returned cache hit ratio matches the expected ratio within 1 percentage point (or exact fraction equivalence).
- **SC-005**: Every successful experiment response (or metrics read) that completes a measurement window includes all four required metrics: hit ratio, latency, key count, and memory usage.
- **SC-006**: Learners can complete a basic get/set/delete learning loop (write → read hit → delete → read miss) in under 2 minutes when following lab instructions, with metrics visible without FE-side metric computation.
- **SC-007**: Input Surface metadata for Redis Track is sufficient for FE to render a command/config panel without hard-coding allowlisted command names in multiple places (single metadata contract).

## Assumptions

- Worker Queue Foundation and Metrics Pipeline are available; this feature may reuse Metric Contract shapes and correlation patterns from Metrics Pipeline without redefining the global contract.
- MVP Redis Track labs need get/set/delete plus optional TTL-related operations; advanced modules (streams, pub/sub, cluster admin) are out of scope unless a specific lab later requires them.
- Default per-operation timeout is 5 seconds for interactive cache ops unless overridden by configuration (shorter than SQL default because cache ops are expected to be fast).
- Default max value size is 64 KB; default max keys per session is 1,000; default session memory soft cap is 16 MB unless overridden.
- Isolation may be implemented via dedicated instances, databases/logical DBs, or strict key namespacing—as long as cross-session invisibility and platform-key separation hold. Exact mechanism is a design decision for planning.
- Redis Track experiment APIs require authentication in MVP; anonymous Redis sandbox access is out of scope.
- Platform infrastructure may use Redis for queues; Playground Redis for labs is a separate logical runtime concern even if co-hosted in non-production environments.
- Per-user rate limiting remains the responsibility of the existing Per-User Rate Limit feature; this feature only enforces per-operation and per-session resource caps.
- Individual Redis lab curricula (Cache Aside, Stampede, etc.) are separate backlog features that depend on this runtime.

## Out of Scope

- Redis Track lab content, scenarios, and quizzes (Cache Aside, Write Through, Write Behind, Invalidation, TTL, Stampede, Benchmark Lab)
- Frontend charts, editors, and visualization kits (FE-owned; consumes Metric Contract and Input Surface metadata only)
- Playground PostgreSQL changes or SQL sandbox changes
- Benchmark load generation against Redis (Benchmark infrastructure / Redis Benchmark lab)
- Changing Worker Queue Foundation behavior beyond ensuring playground session keys do not collide with queue keys
- Multi-region Redis, cluster topology teaching, or Redis Stack modules beyond MVP allowlist
- Anonymous (unauthenticated) Redis experiment execution
