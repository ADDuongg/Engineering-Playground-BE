# Data Model: Dataset Reset

**Feature**: 004-dataset-reset | **Date**: 2026-07-08

Extends Dataset Loader data model. No new Platform DB entities. Playground teardown + re-seed only.

## ResetDatasetInput (request contract)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `family` | string | yes | Dataset family id (e.g. `commerce`) |
| `tier` | `DatasetTier` | yes | `100k`, `1m`, or `10m` |
| `version` | string | no | Defaults to manifest default (`v1`) |
| `context` | `DatasetResetContext` | no | Correlation metadata |

## DatasetResetContext

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `requestId` | string | no | HTTP correlation |
| `labSlug` | string | no | Lab identifier |
| `userId` | string | no | Authenticated user if present |

## ResetDatasetResult (response contract)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `family` | string | Dataset family |
| `version` | string | Dataset version |
| `tier` | `DatasetTier` | Size tier |
| `status` | `DatasetReadinessStatus` | `ready` (sync) or `resetting` (async) |
| `durationMs` | number | Present when sync completes with `ready` |
| `startedAt` | string | ISO8601 when async `resetting` |

## DatasetReadinessStatus (enum — extended)

| Value | Meaning |
| ----- | ------- |
| `not_started` | No preparation/reset recorded |
| `preparing` | Initial seed load in progress |
| `resetting` | **NEW** — Teardown + re-seed in progress |
| `ready` | Playground matches manifest baseline |
| `failed` | Last prepare or reset failed |

## DatasetPreparationStatus (Redis + API — unchanged shape)

Reset reuses the same structure. When reset runs, `status` transitions through `resetting` → `ready` | `failed`.

## DatasetResetError

| Field | Type | Description |
| ----- | ---- | ----------- |
| `code` | string | e.g. `RESET_EXECUTION_FAILED`, `RESET_LOCK_CONFLICT`, `UNKNOWN_TIER` |
| `message` | string | Learner-facing message |
| `hint` | string | Optional guidance (e.g. retry after query completes) |

## State Transitions (reset-specific)

```text
ready
  → reset requested → resetting → success → ready
                              → failure → failed
failed
  → reset retry → resetting → ready | failed
not_started
  → reset requested → resetting → ready | failed   # equivalent to prepare+reset
preparing
  → reset requested → return existing preparing (no parallel op)
resetting
  → duplicate reset → return existing resetting (no parallel op)
```

## Redis Key Pattern

Unchanged from Dataset Loader:

```text
dataset:prep:{family}:{version}:{tier}
```

## Teardown Scope

`DatasetPlaygroundTeardown` uses manifest `tables[].name` as baseline allowlist. Any `public` schema table not in allowlist is `DROP TABLE … CASCADE` before seed runner executes.

## Relationships

- **ResetDatasetUseCase** validates identity via **DatasetManifestRepository**
- **ResetDatasetUseCase** marks **DatasetPreparationStatus** `resetting` via **DatasetPreparationStatusStore**
- **DatasetPlaygroundTeardown** removes extra playground objects
- **DatasetSeedRunner** reloads schema + tier seed (shared with prepare)
- **GetDatasetMetadataUseCase** unchanged — reflects post-reset `ready` state

## Audit Event (structured log — not persisted entity)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `event` | `'dataset_reset'` | Fixed event name |
| `family` | string | Dataset family |
| `version` | string | Dataset version |
| `tier` | string | Tier id |
| `status` | `'started' \| 'completed' \| 'failed'` | Terminal logging |
| `durationMs` | number | Wall-clock when terminal |
| `requestId` | string | Optional correlation |
| `labSlug` | string | Optional lab context |
| `errorCode` | string | When failed |
