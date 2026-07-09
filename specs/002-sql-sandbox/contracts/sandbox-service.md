# Service Contract: SQL Sandbox

**Feature**: 002-sql-sandbox | **Module**: `SqlSandboxModule` | **Consumer**: Experiment Runner, Explain Runner (future)

This feature exposes an **internal NestJS service contract**, not a public HTTP API.

---

## ExecuteSandboxedSqlUseCase

**Purpose**: Validate and execute a single parameterized SQL statement against Playground PostgreSQL within sandbox limits.

### Input: `SandboxExecuteInput`

```typescript
interface SandboxExecuteInput {
  sql: string;
  parameters: unknown[];
  context?: {
    requestId?: string;
    trackSlug?: string;
    labSlug?: string;
    userId?: string;
  };
}
```

### Output (success): `SandboxExecuteResult`

```typescript
interface SandboxExecuteResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  fields?: Array<{ name: string; dataTypeId: number }>;
}
```

### Output (failure): throws `DomainError`

| ErrorCode | HTTP status (when surfaced by future API) | When |
| --------- | ----------------------------------------- | ---- |
| `VALIDATION_ERROR` | 400 | Empty SQL, invalid input shape |
| `SANDBOX_ERROR` | 403 | Policy violation (disallowed statement, blocked pattern) |
| `TIMEOUT` | 408 | Query exceeded `queryTimeoutMs` |
| `EXECUTION_ERROR` | 422 | PostgreSQL syntax/runtime error |

`DomainError.details` MAY include:

```typescript
{
  violationCode: SandboxViolationCode;
  hint?: string;
  policyVersion: string;
}
```

---

## ValidateSqlStatementService

**Purpose**: Pre-execution validation without contacting PostgreSQL (except future EXPLAIN-only dry runs — out of scope).

### Input

Same `sql` and `parameters` as execute input.

### Output

```typescript
interface SqlValidationResult {
  valid: true;
  normalizedSql: string;
  statementKind: SqlStatementKind;
}
// OR throws DomainError (SANDBOX_ERROR | VALIDATION_ERROR)
```

---

## Configuration contract

Environment variables (with defaults):

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `SANDBOX_QUERY_TIMEOUT_MS` | `30000` | Per-query timeout |
| `SANDBOX_MAX_ROWS` | `10000` | Max rows returned |
| `SANDBOX_POLICY_VERSION` | `1` | Policy traceability |

---

## MVP allowlist

| Statement kind | Allowed | Notes |
| -------------- | ------- | ----- |
| SELECT | yes | May auto-limit rows |
| EXPLAIN / EXPLAIN ANALYZE | yes | Wrapped SELECT validation |
| CREATE INDEX | yes | Playground tables only |
| DROP INDEX | yes | Playground indexes only |
| INSERT / UPDATE / DELETE | no | Future via policy bump |
| DDL (tables, schemas) | no | |
| COPY TO/FROM PROGRAM | no | Blocked pattern |
| GRANT / REVOKE / ROLE | no | |
| Extension install | no | |

---

## Integration example (future Experiment Runner)

```typescript
// Pseudocode — not implemented in this feature
const result = await this.executeSandboxedSql.execute({
  sql: 'SELECT * FROM users WHERE id = $1',
  parameters: [userId],
  context: { requestId, trackSlug: 'database-sql', labSlug: 'index-lab' },
});
```

---

## Logging

On sandbox violation or timeout, log at `warn` level:
- `requestId`, `trackSlug`, `labSlug`, `userId`, `violationCode`, `policyVersion`
- Do NOT log full SQL or parameter values in production (truncate/hash if needed for debug)
