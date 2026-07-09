# Data Model: Dataset Loader

**Feature**: 003-dataset-loader | **Date**: 2026-07-08

Seed **row data** lives in Playground PostgreSQL only. **Metadata and status** come from manifest files and Redis. No new Platform DB entities in MVP.

## DatasetManifest (configuration file)

Loaded from `seeds/datasets/manifest.json` at startup (refreshed on prepare if file watcher not used in MVP).

| Field | Type | Description |
| ----- | ---- | ----------- |
| `families` | `DatasetFamilyManifest[]` | Registered dataset families |

### DatasetFamilyManifest

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `id` | string | yes | e.g. `commerce` |
| `label` | string | yes | Learner-facing name |
| `description` | string | yes | What this family teaches |
| `versions` | `DatasetVersionManifest[]` | yes | Published versions |

### DatasetVersionManifest

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `id` | string | yes | e.g. `v1` |
| `schemaPath` | string | yes | Relative path to `schema.sql` |
| `tiers` | `DatasetTierManifest[]` | yes | Supported tiers |

### DatasetTierManifest

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `id` | `DatasetTier` | yes | `100k` \| `1m` \| `10m` |
| `seedPath` | string | yes | Relative path to tier seed SQL |
| `tables` | `DatasetTableManifest[]` | yes | Expected tables and target counts |

### DatasetTableManifest

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `name` | string | yes | Table name in playground |
| `label` | string | yes | Learner-facing label |
| `description` | string | yes | Educational description |
| `targetRowCount` | number | yes | Expected rows after successful load |

**Validation rules**:
- `id` fields MUST be unique within their parent scope
- `targetRowCount` MUST be > 0
- `seedPath` / `schemaPath` MUST resolve to existing files at runtime

## PrepareDatasetInput (request contract)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `family` | string | yes | Dataset family id |
| `version` | string | no | Defaults to latest/default in manifest (`v1`) |
| `tier` | `DatasetTier` | yes | `100k`, `1m`, or `10m` |
| `context` | `DatasetPreparationContext` | no | Correlation metadata |

## DatasetPreparationContext (metadata)

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `requestId` | string | no | HTTP correlation |
| `labSlug` | string | no | Lab identifier |
| `userId` | string | no | Authenticated user if present |

## DatasetPreparationStatus (Redis + API)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `family` | string | Dataset family |
| `version` | string | Dataset version |
| `tier` | `DatasetTier` | Size tier |
| `status` | `DatasetReadinessStatus` | Lifecycle state |
| `startedAt` | ISO8601 string | Preparation start time |
| `completedAt` | ISO8601 string \| null | Completion time when terminal |
| `durationMs` | number \| null | Wall-clock duration when complete |
| `error` | `DatasetPreparationError` \| null | Present when `failed` |

## DatasetReadinessStatus (enum)

| Value | Meaning |
| ----- | ------- |
| `not_started` | No preparation recorded for this identity |
| `preparing` | Seed scripts executing |
| `ready` | Playground matches manifest expectations |
| `failed` | Preparation failed; see `error` |

## DatasetMetadata (response contract)

| Field | Type | Description |
| ----- | ---- | ----------- |
| `family` | string | Dataset family id |
| `familyLabel` | string | Learner-facing family name |
| `version` | string | Active version |
| `tier` | `DatasetTier` | Active tier |
| `status` | `DatasetReadinessStatus` | Current readiness |
| `tables` | `DatasetTableMetadata[]` | Table catalog with live counts |

## DatasetTableMetadata

| Field | Type | Description |
| ----- | ---- | ----------- |
| `name` | string | Table name |
| `label` | string | Learner-facing label |
| `description` | string | Educational description |
| `targetRowCount` | number | Expected from manifest |
| `actualRowCount` | number \| null | Live count when `ready`; null otherwise |

## DatasetPreparationError

| Field | Type | Description |
| ----- | ---- | ----------- |
| `code` | string | e.g. `SEED_EXECUTION_FAILED`, `MANIFEST_NOT_FOUND` |
| `message` | string | Learner-facing message |
| `hint` | string | Optional guidance |

## State Transitions

```text
not_started
  → prepare requested
    → preparing
      → success → ready
      → failure → failed
failed
  → prepare retry → preparing
ready
  → prepare same identity (explicit refresh) → preparing → ready | failed
preparing
  → duplicate prepare request → return existing preparing status (no parallel run)
```

## Redis Key Pattern

```text
dataset:prep:{family}:{version}:{tier}
```

Value: JSON-serialized `DatasetPreparationStatus`. TTL: `dataset.loader.preparationTtlSeconds` (default 3600).

## Relationships

- **DatasetManifestRepository** reads **DatasetManifest** from disk
- **PrepareDatasetUseCase** validates identity → updates **DatasetPreparationStatus** → delegates to **DatasetSeedRunner**
- **DatasetSeedRunner** uses **PlaygroundDatabaseService** to execute SQL files
- **GetDatasetMetadataUseCase** combines manifest + status + optional live counts
- **Dataset Reset** (future) will call the same runner path after teardown
