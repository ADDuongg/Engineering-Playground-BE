# API Contract: Dataset Reset

**Feature**: 004-dataset-reset | **Module**: `DatasetLoaderModule` (extended) | **Base path**: `/datasets`

All responses use the standard API envelope: `{ success, data, meta, error }`.

---

## POST /datasets/reset

**Purpose**: Restore Playground PostgreSQL to the configured dataset baseline — removing experiment mutations and reloading seed artifacts.

### Request body: `ResetDatasetDto`

```typescript
interface ResetDatasetDto {
  family: string;           // e.g. "commerce"
  tier: '100k' | '1m' | '10m';
  version?: string;         // defaults to "v1"
  context?: {
    labSlug?: string;
  };
}
```

### Response (sync — 100K tier): `200 OK`

```typescript
interface ResetDatasetResult {
  family: string;
  version: string;
  tier: '100k' | '1m' | '10m';
  status: 'ready';
  durationMs: number;
  startedAt: string;
}
```

### Response (async — 1M / 10M tiers): `202 Accepted`

```typescript
interface ResetDatasetResult {
  family: string;
  version: string;
  tier: '100k' | '1m' | '10m';
  status: 'resetting';
  startedAt: string;
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `VALIDATION_ERROR` | 400 | Missing/invalid family, tier, or version |
| `NOT_FOUND` | 404 | Unknown family or version in manifest |
| `EXECUTION_ERROR` | 422 | Teardown or seed failed (sync path) |

`DomainError.details` MAY include:

```typescript
{
  code: 'RESET_EXECUTION_FAILED' | 'RESET_LOCK_CONFLICT' | 'UNKNOWN_TIER';
  hint?: string;
}
```

---

## GET /datasets/reset/status

**Purpose**: Poll reset status for a dataset identity. Returns the shared preparation status object (includes `resetting` state).

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
  status: 'not_started' | 'preparing' | 'resetting' | 'ready' | 'failed';
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

**Note**: `GET /datasets/prepare/status` returns the same object for the identity. Either endpoint MAY be used for polling after reset; `reset/status` is the reset-specific alias for lab shells.

---

## Internal module exports

| Export | Purpose |
| ------ | ------- |
| `ResetDatasetUseCase` | Programmatic reset with same contract as HTTP |
| `DatasetLoaderModule` | Existing module — exports reset use case |

### ResetDatasetInput (internal)

```typescript
interface ResetDatasetInput {
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

1. **Experiment Runner** MUST treat `resetting` the same as `preparing` — SQL execution blocked until `ready`.
2. **Dataset Loader** `PrepareDatasetUseCase` and `ResetDatasetUseCase` MUST NOT run concurrently for the same `{family, version, tier}` identity.
3. **GetDatasetMetadataUseCase** returns updated counts after reset reaches `ready`.
4. **Worker Queue Foundation** (future) SHOULD replace in-process async reset for 1M/10M without changing HTTP contract.
5. **Platform DB** MUST remain unchanged by all reset operations.

---

## Observability

Structured logs on reset (no PII, no query text):

```typescript
{
  event: 'dataset_reset';
  family: string;
  version: string;
  tier: string;
  status: 'started' | 'completed' | 'failed';
  durationMs?: number;
  requestId?: string;
  labSlug?: string;
  errorCode?: string;
}
```

Seed SQL and teardown statements MUST NOT appear in logs.
