# Data Model: Experiment Isolation

**Feature**: 006-experiment-isolation | **Date**: 2026-07-08

No new Platform DB entities. Session metadata in Redis; runtime objects in Playground PostgreSQL session schemas.

## ExperimentSession (Redis-backed)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `sessionId` | string | yes | Opaque platform-issued identifier (UUID) |
| `clientSessionToken` | string | yes | Client-supplied stable token for reuse lookup |
| `status` | `ExperimentSessionStatus` | yes | Lifecycle state |
| `trackSlug` | string | yes | Track identifier |
| `labSlug` | string | yes | Lab identifier |
| `runtimeAdapter` | `RuntimeAdapterType` | yes | Resolved adapter for Track |
| `schemaName` | string | yes | Playground PostgreSQL schema (Database Track) |
| `dataset` | `ExperimentSessionDatasetRef` | yes | Configured dataset identity for lab |
| `createdAt` | string (ISO) | yes | Provision timestamp |
| `lastActivityAt` | string (ISO) | yes | Updated on prepare/run/reset |
| `expiresAt` | string (ISO) | yes | Idle expiry deadline |
| `error` | `ExperimentSessionError` | no | Present when status is `failed` |

## ExperimentSessionStatus

| Value | Description |
| ----- | ----------- |
| `provisioning` | Schema creation in progress |
| `ready` | Runtime context available for downstream ops |
| `failed` | Provisioning or unrecoverable error |
| `tearing_down` | Teardown in progress |
| `expired` | TTL elapsed; schema pending or completed cleanup |

## ExperimentSessionDatasetRef

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `family` | string | yes | Dataset family id |
| `tier` | `DatasetTier` | yes | Size tier |
| `version` | string | no | Defaults to manifest default |

## ProvisionExperimentSessionInput

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `clientSessionToken` | string | yes | Client isolation key |
| `trackSlug` | string | yes | Track for adapter resolution |
| `labSlug` | string | yes | Lab identifier |
| `dataset` | `ExperimentSessionDatasetRef` | yes | Lab dataset configuration |
| `context` | `ExperimentSessionContext` | no | Correlation metadata |

## ExperimentSessionContext

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `requestId` | string | no | HTTP correlation |
| `userId` | string | no | Authenticated user when available |

## ExperimentSessionError

| Field | Type | Description |
| ----- | ---- | ----------- |
| `code` | string | e.g. `PROVISION_FAILED`, `TEARDOWN_FAILED`, `UNSUPPORTED_TRACK` |
| `message` | string | Learner-facing summary |
| `hint` | string | Actionable guidance |

## Redis Keys

| Key pattern | Value | TTL |
| ----------- | ----- | --- |
| `experiment:session:{sessionId}` | JSON `ExperimentSession` | `session.idleTtlSeconds` |
| `experiment:session:lookup:{token}:{trackSlug}:{labSlug}` | `sessionId` | Same as session |

## Session-Scoped Dataset Status Key Extension

When `sessionId` is provided to Dataset Loader:

```text
dataset:prep:{sessionId}:{family}:{version}:{tier}
```

When omitted (legacy):

```text
dataset:prep:{family}:{version}:{tier}
```

## Lifecycle

```text
POST /experiments/sessions
  → lookup reuse by (clientSessionToken, trackSlug, labSlug)
  → if reuse ready → return existing
  → else CREATE SCHEMA exp_{id}
  → status ready

Prepare / Reset / Run (with sessionId)
  → SET LOCAL search_path = '{schemaName}, public'
  → session-scoped dataset status keys

DELETE /experiments/sessions/:id
  → status tearing_down
  → DROP SCHEMA CASCADE
  → delete Redis keys
```

## Audit Event (structured log)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `event` | `'experiment_session'` | Fixed name |
| `phase` | `'provision_started' \| 'provision_completed' \| 'provision_failed' \| 'teardown_started' \| 'teardown_completed' \| 'teardown_failed' \| 'expired'` | Phase |
| `sessionId` | string | Session identifier |
| `trackSlug` | string | Track |
| `labSlug` | string | Lab |
| `schemaName` | string | Database Track only |
| `durationMs` | number | When completed/failed |
| `errorCode` | string | When failed |

## Relationships

- **ProvisionExperimentSessionUseCase** writes **ExperimentSessionStore** and calls **PlaygroundSchemaProvisioner**
- **GetExperimentSessionUseCase** reads store only
- **TeardownExperimentSessionUseCase** drops schema and deletes store entries
- **PrepareDatasetUseCase**, **ResetDatasetUseCase**, **ExecuteSandboxedSqlUseCase** accept optional `sessionId` and resolve schema via **GetExperimentSessionUseCase**
