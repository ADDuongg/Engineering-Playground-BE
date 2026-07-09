# API Contract: Dataset Loader

**Feature**: 003-dataset-loader | **Module**: `DatasetLoaderModule` | **Base path**: `/datasets`

All responses use the standard API envelope: `{ success, data, meta, error }`.

---

## POST /datasets/prepare

**Purpose**: Load (or refresh) a platform dataset into Playground PostgreSQL for a given family, version, and tier.

### Request body: `PrepareDatasetDto`

```typescript
interface PrepareDatasetDto {
  family: string;           // e.g. "commerce"
  tier: '100k' | '1m' | '10m';
  version?: string;         // defaults to "v1"
}
```

### Response (sync — 100K tier): `200 OK`

```typescript
interface PrepareDatasetResult {
  family: string;
  version: string;
  tier: '100k' | '1m' | '10m';
  status: 'ready';
  durationMs: number;
}
```

### Response (async — 1M / 10M tiers): `202 Accepted`

```typescript
interface PrepareDatasetResult {
  family: string;
  version: string;
  tier: '100k' | '1m' | '10m';
  status: 'preparing';
  startedAt: string;
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `VALIDATION_ERROR` | 400 | Missing/invalid family, tier, or version |
| `NOT_FOUND` | 404 | Unknown family or version in manifest |
| `EXECUTION_ERROR` | 422 | Seed SQL failed (sync path) |

`DomainError.details` MAY include:

```typescript
{
  code: 'SEED_EXECUTION_FAILED' | 'MANIFEST_NOT_FOUND' | 'UNKNOWN_TIER';
  hint?: string;
}
```

---

## GET /datasets/prepare/status

**Purpose**: Poll preparation status for a dataset identity.

### Query parameters

| Param | Required | Description |
| ----- | -------- | ----------- |
| `family` | yes | Dataset family id |
| `tier` | yes | `100k`, `1m`, or `10m` |
| `version` | no | Defaults to `v1` |

### Response: `200 OK`

```typescript
interface DatasetPreparationStatus {
  family: string;
  version: string;
  tier: '100k' | '1m' | '10m';
  status: 'not_started' | 'preparing' | 'ready' | 'failed';
  startedAt?: string;
  completedAt?: string | null;
  durationMs?: number | null;
  error?: {
    code: string;
    message: string;
    hint?: string;
  } | null;
}
```

---

## GET /datasets/metadata

**Purpose**: Return learner-facing dataset catalog for lab shells.

### Query parameters

Same as `/datasets/prepare/status`.

### Response: `200 OK`

```typescript
interface DatasetMetadata {
  family: string;
  familyLabel: string;
  version: string;
  tier: '100k' | '1m' | '10m';
  status: 'not_started' | 'preparing' | 'ready' | 'failed';
  tables: Array<{
    name: string;
    label: string;
    description: string;
    targetRowCount: number;
    actualRowCount: number | null;
  }>;
}
```

When `status` is not `ready`, `actualRowCount` is `null` for all tables.

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `VALIDATION_ERROR` | 400 | Invalid query params |
| `NOT_FOUND` | 404 | Unknown family/version |

---

## Internal module exports

For downstream **Experiment Runner** and **Dataset Reset**:

| Export | Purpose |
| ------ | ------- |
| `PrepareDatasetUseCase` | Programmatic preparation with same contract as HTTP |
| `GetDatasetMetadataUseCase` | Metadata for lab orchestration |
| `DatasetLoaderModule` | NestJS module import |

### PrepareDatasetInput (internal)

```typescript
interface PrepareDatasetInput {
  family: string;
  tier: DatasetTier;
  version?: string;
  context?: {
    requestId?: string;
    labSlug?: string;
    userId?: string;
  };
}
```

---

## Integration rules

1. **Experiment Runner** MUST NOT execute SQL until metadata `status === 'ready'` for the lab's configured dataset.
2. **SQL Sandbox** remains unchanged; dataset loader only populates playground tables.
3. **Dataset Reset** (future) SHOULD reuse `DatasetSeedRunner` after teardown.
4. **Worker Queue Foundation** (future) SHOULD replace in-process async preparation for 1M/10M without changing HTTP contract.

---

## Observability

Structured logs on preparation (no PII):

```typescript
{
  event: 'dataset_preparation';
  family: string;
  version: string;
  tier: string;
  status: 'started' | 'completed' | 'failed';
  durationMs?: number;
  requestId?: string;
  labSlug?: string;
}
```

Seed SQL content MUST NOT appear in logs.
