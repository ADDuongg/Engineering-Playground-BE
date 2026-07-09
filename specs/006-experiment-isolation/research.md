# Research: Experiment Isolation

**Feature**: 006-experiment-isolation | **Date**: 2026-07-08

## 1. Isolation Mechanism for Database Track

**Decision**: PostgreSQL schema-per-session within the shared Playground PostgreSQL database. Each session receives a unique schema name (`exp_{shortId}`) and all dataset tables are created inside that schema.

**Rationale**: Dataset Loader already runs DDL/DML via `PlaygroundDatabaseService`. Schema isolation is well-supported via `search_path`, requires no new infrastructure, and satisfies FR-004 on a single PG instance. Aligns with spec assumption and ENGINEERING_GUIDE boring architecture.

**Alternatives considered**:
- **Separate database per session**: Strong isolation but heavy connection/pool management; rejected for MVP.
- **Row-level tenant column**: Requires rewriting all seed SQL and invites cross-session UPDATE leaks; rejected.
- **Shared public schema + reset only**: Fails concurrent multi-user isolation; rejected.

## 2. Session Identity and Reuse

**Decision**: Client supplies `clientSessionToken` (header `X-Session-Token` or body field). Platform maps `(clientSessionToken, labSlug, trackSlug)` to one active session, reusing if status is `ready` and not expired.

**Rationale**: Spec edge case: avoid unbounded schema proliferation. Matches anonymous MVP before Authentication.

**Alternatives considered**:
- **New session on every provision request**: Orphan schema explosion; rejected.
- **User ID only after auth**: Deferred — optional `userId` enriches audit when present.

## 3. Session Metadata Storage

**Decision**: Redis hash/string keyed `experiment:session:{sessionId}` with TTL aligned to idle expiry (default 3600s, refreshed on activity).

**Rationale**: Session state is disposable runtime metadata — matches Dataset Loader status store pattern. No platform DB migration required.

**Alternatives considered**:
- **Platform DB table**: Adds migration and mixes permanent/session data; deferred unless audit retention requires it.
- **In-memory only**: Lost on restart; rejected.

## 4. Integration with Dataset Loader / Reset / Sandbox

**Decision**: Add optional `sessionId?: string` to `PrepareDatasetInput`, `ResetDatasetInput`, `SandboxExecuteInput`, `ExperimentRunInput`. When present:
- Status store keys become `dataset:prep:{sessionId}:{family}:{version}:{tier}`
- Seed runner qualifies DDL with target schema or sets `search_path` before seed
- Sandbox execute runs inside `SET LOCAL search_path = '{schema}, public'`

**Rationale**: Minimal contract extension; existing callers without `sessionId` keep global behavior during migration.

**Alternatives considered**:
- **Require sessionId immediately**: Breaks existing tests and quickstarts; rejected.
- **Separate session-scoped APIs only**: Duplicates endpoints; rejected.

## 5. HTTP Surface

**Decision**:
- `POST /experiments/sessions` — provision or reuse session (body: trackSlug, labSlug, dataset ref, clientSessionToken)
- `GET /experiments/sessions/:sessionId` — status lookup
- `DELETE /experiments/sessions/:sessionId` — explicit teardown

**Rationale**: `/experiments/*` namespace consistent with Experiment Runner. Lab shell flow: provision session → prepare dataset with sessionId → run SQL with sessionId.

**Alternatives considered**:
- **Embed provision in prepare endpoint**: Couples loader to isolation lifecycle; rejected — separation of concerns.
- **Cookie-only session without explicit ID**: Harder for API clients and integration tests; rejected.

## 6. Track Resolution

**Decision**: `ProvisionExperimentSessionUseCase` validates `trackSlug` against Track Registry (or hardcoded allowlist for MVP: `database-sql` → `PLAYGROUND_POSTGRESQL`). Unsupported tracks throw `DomainError` with `ISOLATION_UNSUPPORTED_TRACK`.

**Rationale**: FR-008 Track-aware adapter resolution. Track Registry module already exists (001).

**Alternatives considered**:
- **Assume Database Track always**: Fails FR-008; rejected.
- **Dynamic adapter plugin registry**: Over-engineered for MVP single-track validation; deferred.

## 7. Failure Recovery

**Decision**: On provisioning failure after `CREATE SCHEMA`, run `DROP SCHEMA IF EXISTS ... CASCADE` in finally block before marking session `failed`. Retry allowed when status is `failed` — creates new schema name.

**Rationale**: FR-010 recovery without operator intervention. SC-005 retry success.

**Alternatives considered**:
- **Leave partial schema for manual cleanup**: Violates SC-006; rejected.
- **Block all retries for 24h**: Poor learner UX; rejected.

## 8. Teardown Strategy

**Decision**: Synchronous `DROP SCHEMA CASCADE` for explicit DELETE. Idle expiry via Redis TTL + optional background sweep listing `exp_*` schemas without Redis keys.

**Rationale**: Meets FR-006. Async sweep handles TTL edge cases without blocking HTTP on DELETE timeout.

**Alternatives considered**:
- **Never auto-expire**: Resource leak; rejected.
- **Always async teardown**: Complicates integration tests for SC-006; sync for explicit close, async for expiry.
