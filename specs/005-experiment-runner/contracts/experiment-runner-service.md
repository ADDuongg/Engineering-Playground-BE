# API Contract: Experiment Runner

**Feature**: 005-experiment-runner | **Module**: `ExperimentRunnerModule` | **Base path**: `/experiments`

All responses use the standard API envelope: `{ success, data, meta, error }`.

---

## POST /experiments/sql/run

**Purpose**: Execute learner SQL in a lab context after verifying the target dataset is ready. Delegates to SQL Sandbox for validation and playground execution.

### Request body: `RunExperimentSqlDto`

```typescript
interface RunExperimentSqlDto {
  sql: string;
  parameters: unknown[];
  dataset: {
    family: string;           // e.g. "commerce"
    tier: '100k' | '1m' | '10m';
    version?: string;         // defaults to "v1"
  };
  context?: {
    trackSlug?: string;       // e.g. "database-sql"
    labSlug?: string;         // e.g. "index-playground"
  };
}
```

### Response (success): `200 OK`

```typescript
interface ExperimentRunResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  fields?: Array<{ name: string; dataTypeId: number }>;
  dataset: {
    family: string;
    tier: '100k' | '1m' | '10m';
    version: string;
  };
  statementKind: SqlStatementKind;
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `VALIDATION_ERROR` | 400 | Missing/invalid body fields |
| `SANDBOX_ERROR` | 403 | Sandbox policy violation |
| `TIMEOUT` | 408 | Query exceeded timeout |
| `EXECUTION_ERROR` | 422 | Dataset not ready, PostgreSQL error, or other execution failure |

#### Dataset not ready (`EXECUTION_ERROR`)

```typescript
{
  reason: 'DATASET_NOT_READY';
  status: 'not_started' | 'preparing' | 'resetting' | 'failed';
  hint: string;  // e.g. "Prepare the dataset before running SQL."
}
```

#### Sandbox violation (`SANDBOX_ERROR`)

Passthrough from SQL Sandbox — includes `violationCode`, `hint`, `policyVersion` in `details`.

---

## Internal module exports

| Export | Purpose |
| ------ | ------- |
| `RunExperimentSqlUseCase` | Programmatic execution with same contract as HTTP |
| `ExperimentRunnerModule` | NestJS module import for future Lab Shell orchestration |

### ExperimentRunInput (internal)

```typescript
interface ExperimentRunInput {
  sql: string;
  parameters: unknown[];
  dataset: {
    family: string;
    tier: DatasetTier;
    version?: string;
  };
  context?: {
    requestId?: string;
    trackSlug?: string;
    labSlug?: string;
    userId?: string;
  };
}
```

---

## Integration rules

1. **Experiment Runner** MUST NOT execute SQL until dataset metadata `status === 'ready'` for the requested identity.
2. **SQL Sandbox** remains the sole authority for statement validation, timeout, and row caps — Experiment Runner MUST NOT reimplement rules.
3. **Explain Runner** (future) SHOULD follow the same readiness gate pattern with explain-specific sandbox delegation.
4. **SQL Execution Queue** (future) SHOULD enqueue `RunExperimentSqlUseCase` without changing the HTTP contract.
5. **Lab Shell** SHOULD call `/experiments/sql/run` rather than `/sql/sandbox/execute` for learner-facing runs.

---

## Observability

Structured logs (no PII, no SQL text):

```typescript
{
  event: 'experiment_sql_run';
  phase: 'started' | 'completed' | 'failed';
  family: string;
  version: string;
  tier: string;
  trackSlug?: string;
  labSlug?: string;
  userId?: string;
  requestId?: string;
  durationMs?: number;
  rowCount?: number;
  errorCode?: string;
  statementKind?: string;
}
```

---

## Auth

Bearer JWT optional where global auth guard permits anonymous lab access. When authenticated, `userId` from JWT is included in execution context and audit logs.
