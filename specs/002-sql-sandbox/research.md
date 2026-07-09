# Research: SQL Sandbox & Resource Limits

**Feature**: 002-sql-sandbox | **Date**: 2026-07-08

## 1. SQL Statement Classification

**Decision**: Use `pgsql-ast-parser` to parse PostgreSQL statements into an AST and classify statement type (SELECT, EXPLAIN, CREATE INDEX, etc.).

**Rationale**: Regex-only validation is brittle for nested comments, string literals, and multi-keyword statements. A lightweight parser gives reliable statement-type detection without pulling in the full `pg` query planner. The library is PostgreSQL-specific, matching the Database Track runtime.

**Alternatives considered**:
- **Regex blocklist**: Simple but false positives/negatives on edge cases; rejected for security-critical path.
- **node-pg-query-parser**: Heavier native dependency; rejected for MVP simplicity.
- **Delegate to PostgreSQL only**: Cannot block dangerous statements before execution; rejected.

## 2. Parameterized Query Enforcement

**Decision**: Require callers to pass SQL with `$1`, `$2`, … placeholders and a parallel `parameters` array. Reject SQL containing suspicious patterns (string concatenation markers, multiple statements separated by `;`) at validation time. Execution always uses `PlaygroundDatabaseService.query(sql, parameters)`.

**Rationale**: Aligns with ENGINEERING_GUIDE §12 and TypeORM/pg parameterized execution. Callers (Experiment Runner) own binding; sandbox enforces the contract.

**Alternatives considered**:
- **Auto-parameterize literals**: Too magic, error-prone; rejected.
- **Allow literal-only SELECT for MVP**: Weakens security story; rejected.

## 3. Timeout Enforcement

**Decision**: Set `statement_timeout` via `SET LOCAL statement_timeout = '<ms>'` on a dedicated connection checkout per execution (using a short transaction wrapper), then reset after query completes.

**Rationale**: PostgreSQL-native timeout kills runaway queries reliably. `SET LOCAL` scopes to transaction so pool connections are not permanently altered.

**Alternatives considered**:
- **Promise.race only**: Does not stop DB-side work; rejected.
- **Separate connection per user session**: Out of scope (Experiment Isolation feature); rejected for now.

## 4. Row Return Cap

**Decision**: For SELECT statements without a LIMIT clause, append `LIMIT maxRows + 1` at validation/rewrite layer when safe (simple SELECT); if rewrite is unsafe (complex query), enforce cap by truncating results in application layer and return `RESOURCE_LIMIT` hint if truncated.

**Rationale**: Prevents unbounded result sets from exhausting memory. Conservative rewrite for simple queries; fallback truncation for complex ones.

**Alternatives considered**:
- **Reject SELECT without LIMIT**: Too restrictive for learners; rejected.
- **Cursor-only streaming**: Over-engineered for MVP labs; deferred.

## 5. Allowed Statement Allowlist (MVP)

**Decision**: Allow `SelectStmt`, `ExplainStmt`, `CreateStmt` (INDEX only), `DropStmt` (INDEX only). Block all other statement types including DML (INSERT/UPDATE/DELETE) except where labs explicitly need them later via policy version bumps.

**Rationale**: Index Lab needs CREATE/DROP INDEX. Most labs are read-heavy. DML can be added when Dataset Loader/Reset defines writable tables.

**Alternatives considered**:
- **Allow all DML on playground**: Increases risk before Dataset Loader defines schema; rejected for MVP.
- **SELECT only**: Blocks Index Lab; rejected.

## 6. Error Categorization

**Decision**: Map outcomes to existing `ErrorCode` enum: `SANDBOX_ERROR` (policy violation), `TIMEOUT`, `EXECUTION_ERROR` (PostgreSQL errors), `VALIDATION_ERROR` (malformed input). Include optional `hint` field in shared result for educational messages.

**Rationale**: Reuses platform error taxonomy (SYSTEM_DESIGN §17). Frontend can render Track-aware copy from code + hint.

**Alternatives considered**:
- **New error enum values**: Unnecessary; existing codes cover sandbox cases.

## 7. Configuration

**Decision**: Add `sandbox.queryTimeoutMs` (default 30000), `sandbox.maxRows` (default 10000), `sandbox.policyVersion` (default `1`) to `configuration.ts` with env vars `SANDBOX_QUERY_TIMEOUT_MS`, `SANDBOX_MAX_ROWS`.

**Rationale**: Safe defaults satisfy FR-005/FR-006; operators can tune without code changes.

**Alternatives considered**:
- **Hard-coded constants only**: Less operable; rejected.
