# Data Model: SQL Sandbox & Resource Limits

**Feature**: 002-sql-sandbox | **Date**: 2026-07-08

This feature has **no Platform DB persistence**. All entities are in-memory / configuration contracts.

## SandboxPolicy (configuration)

Runtime policy loaded from environment via `ConfigModule`.

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `queryTimeoutMs` | number | 30000 | Per-query timeout in milliseconds |
| `maxRows` | number | 10000 | Maximum rows returned to caller |
| `policyVersion` | string | `"1"` | Traceability for allowlist changes |
| `allowedStatementKinds` | enum[] | SELECT, EXPLAIN, CREATE_INDEX, DROP_INDEX | MVP allowlist |

**Validation rules**:
- `queryTimeoutMs` MUST be ≥ 1000 and ≤ 120000
- `maxRows` MUST be ≥ 1 and ≤ 100000

## SandboxExecuteInput (request contract)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `sql` | string | yes | Single SQL statement with `$n` placeholders |
| `parameters` | unknown[] | yes | Bound parameter values (may be empty array) |
| `context` | SandboxExecutionContext | no | Correlation metadata for logging |

## SandboxExecutionContext (metadata)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `requestId` | string | no | HTTP request correlation |
| `trackSlug` | string | no | e.g. `database-sql` |
| `labSlug` | string | no | Lab identifier |
| `userId` | string | no | Authenticated user if present |

## SandboxExecuteResult (success)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `rows` | Record<string, unknown>[] | Query result rows (capped) |
| `rowCount` | number | Number of rows returned |
| `truncated` | boolean | True if result hit maxRows cap |
| `executionTimeMs` | number | Wall-clock execution duration |
| `fields` | `{ name: string; dataTypeId: number }[]` | Column metadata when available |

## SandboxViolation (failure)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `code` | ErrorCode | `SANDBOX_ERROR`, `TIMEOUT`, `EXECUTION_ERROR`, or `VALIDATION_ERROR` |
| `message` | string | Learner-facing primary message |
| `hint` | string | Optional educational guidance |
| `violationCode` | SandboxViolationCode | Machine-readable sub-code |
| `details` | unknown | Optional structured context (no raw secrets) |

## SandboxViolationCode (enum)

| Value | Meaning |
| ----- | ------- |
| `EMPTY_SQL` | Whitespace-only or empty input |
| `MULTI_STATEMENT` | More than one statement in input |
| `DISALLOWED_STATEMENT` | Statement type not on allowlist |
| `BLOCKED_PATTERN` | Matches dangerous pattern (COPY PROGRAM, etc.) |
| `NON_PARAMETERIZED` | SQL appears to embed dynamic literals unsafely |
| `QUERY_TIMEOUT` | Exceeded statement_timeout |
| `ROW_LIMIT_EXCEEDED` | Result truncated at maxRows |
| `EXECUTION_FAILED` | PostgreSQL execution error |

## State Transitions

```text
Input received
  → validate (pre-flight)
    → fail → SandboxViolation (no DB call)
    → pass → execute on playground connection
      → success → SandboxExecuteResult
      → timeout → SandboxViolation (QUERY_TIMEOUT)
      → pg error → SandboxViolation (EXECUTION_FAILED)
```

## Relationships

- **SandboxPolicy** configures **ValidateSqlStatementService**
- **ExecuteSandboxedSqlUseCase** orchestrates validate → execute → map result
- **PlaygroundDatabaseService** provides connection; no Repository entity layer needed
