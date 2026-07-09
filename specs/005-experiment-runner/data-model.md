# Data Model: Experiment Runner

**Feature**: 005-experiment-runner | **Date**: 2026-07-08

No new Platform DB entities. Orchestration over existing sandbox and dataset status models.

## ExperimentRunInput (request contract)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `sql` | string | yes | Parameterized SQL statement |
| `parameters` | unknown[] | yes | Bound parameter values |
| `dataset` | `ExperimentDatasetRef` | yes | Target dataset identity |
| `context` | `ExperimentExecutionContext` | no | Lab and correlation metadata |

## ExperimentDatasetRef

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `family` | string | yes | Dataset family id (e.g. `commerce`) |
| `tier` | `DatasetTier` | yes | `100k`, `1m`, or `10m` |
| `version` | string | no | Defaults to manifest default (`v1`) |

## ExperimentExecutionContext

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `requestId` | string | no | HTTP correlation |
| `trackSlug` | string | no | Track identifier |
| `labSlug` | string | no | Lab identifier |
| `userId` | string | no | Authenticated user if present |

## ExperimentRunResult (success response)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `rows` | `Record<string, unknown>[]` | Result rows (capped) |
| `rowCount` | number | Number of rows returned |
| `truncated` | boolean | True when row cap applied |
| `executionTimeMs` | number | Wall-clock execution duration |
| `fields` | `ExperimentFieldMeta[]` | Optional column metadata |
| `dataset` | `ExperimentDatasetRef` | Echo of requested identity |
| `statementKind` | `SqlStatementKind` | Classified statement type |

## ExperimentFieldMeta

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | string | Column name |
| `dataTypeId` | number | PostgreSQL OID |

## ExperimentRunError (failure — via DomainError)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `code` | `ErrorCode` | Platform error code |
| `message` | string | Learner-facing message |
| `details` | object | Category-specific payload |

### Dataset not ready details

```typescript
{
  reason: 'DATASET_NOT_READY';
  status: DatasetReadinessStatus;  // preparing | resetting | failed | not_started
  hint?: string;
}
```

### Sandbox failure details

Passthrough from sandbox `DomainError.details` (`violationCode`, `hint`, `policyVersion`).

## Readiness Gate (pre-execution)

```text
RunExperimentSqlUseCase
  → GetDatasetMetadataUseCase(family, tier, version)
  → if status !== ready → throw DATASET_NOT_READY
  → else ExecuteSandboxedSqlUseCase({ sql, parameters, context })
```

## State Dependencies

| Dataset status | Experiment execution |
| -------------- | -------------------- |
| `ready` | Allowed |
| `not_started` | Blocked — hint to prepare dataset |
| `preparing` | Blocked — hint to wait |
| `resetting` | Blocked — hint to wait |
| `failed` | Blocked — hint to retry prepare/reset |

## Audit Event (structured log — not persisted entity)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `event` | `'experiment_sql_run'` | Fixed event name |
| `phase` | `'started' \| 'completed' \| 'failed'` | Lifecycle phase |
| `family` | string | Dataset family |
| `version` | string | Dataset version |
| `tier` | string | Tier id |
| `trackSlug` | string | Optional |
| `labSlug` | string | Optional |
| `userId` | string | Optional |
| `requestId` | string | Optional |
| `durationMs` | number | When completed/failed |
| `rowCount` | number | When completed |
| `errorCode` | string | When failed |
| `statementKind` | string | When completed |

## Relationships

- **RunExperimentSqlUseCase** reads readiness via **GetDatasetMetadataUseCase**
- **RunExperimentSqlUseCase** executes via **ExecuteSandboxedSqlUseCase**
- **ExperimentRunnerController** maps DTO → input; never touches Playground DB directly
