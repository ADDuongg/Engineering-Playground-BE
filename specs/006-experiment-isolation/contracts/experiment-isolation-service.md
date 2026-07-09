# API Contract: Experiment Isolation

**Feature**: 006-experiment-isolation | **Module**: `ExperimentIsolationModule` | **Base path**: `/experiments/sessions`

All responses use the standard API envelope: `{ success, data, meta, error }`.

---

## POST /experiments/sessions

**Purpose**: Provision or reuse an isolated experiment session for a lab visit. Returns session identity for downstream prepare, reset, and run calls.

### Request body: `ProvisionExperimentSessionDto`

```typescript
interface ProvisionExperimentSessionDto {
  clientSessionToken: string;   // stable client key for session reuse
  trackSlug: string;            // e.g. "database-sql"
  labSlug: string;              // e.g. "index-playground"
  dataset: {
    family: string;
    tier: '100k' | '1m' | '10m';
    version?: string;
  };
  context?: {
    requestId?: string;
  };
}
```

### Response (success): `200 OK` or `201 Created`

```typescript
interface ExperimentSessionResponse {
  sessionId: string;
  status: ExperimentSessionStatus;
  trackSlug: string;
  labSlug: string;
  runtimeAdapter: RuntimeAdapterType;
  schemaName?: string;          // Database Track only
  dataset: {
    family: string;
    tier: '100k' | '1m' | '10m';
    version: string;
  };
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  reused: boolean;              // true when existing ready session returned
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `VALIDATION_ERROR` | 400 | Missing/invalid body fields |
| `EXECUTION_ERROR` | 422 | Provisioning failed, unsupported Track |

#### Unsupported Track (`EXECUTION_ERROR`)

```typescript
{
  reason: 'ISOLATION_UNSUPPORTED_TRACK';
  trackSlug: string;
  hint: string;
}
```

#### Provision failed (`EXECUTION_ERROR`)

```typescript
{
  reason: 'ISOLATION_PROVISION_FAILED';
  hint: string;  // e.g. "Retry opening the lab. Contact support if this persists."
}
```

---

## GET /experiments/sessions/:sessionId

**Purpose**: Retrieve current session status for lab shell polling.

### Response (success): `200 OK`

Same shape as `ExperimentSessionResponse` (without `reused`).

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `NOT_FOUND` | 404 | Unknown or expired session |

---

## DELETE /experiments/sessions/:sessionId

**Purpose**: Explicitly tear down session runtime context.

### Response (success): `200 OK`

```typescript
interface TeardownExperimentSessionResult {
  sessionId: string;
  status: 'expired';
  durationMs: number;
}
```

### Errors

| ErrorCode | HTTP | When |
| --------- | ---- | ---- |
| `NOT_FOUND` | 404 | Unknown session |
| `EXECUTION_ERROR` | 422 | Teardown failed (partial cleanup attempted) |

---

## Downstream contract extensions

Existing endpoints accept optional `sessionId` when session isolation is enabled:

| Endpoint | Field added |
| -------- | ----------- |
| `POST /datasets/prepare` | `sessionId?: string` |
| `POST /datasets/reset` | `sessionId?: string` |
| `POST /experiments/sql/run` | `sessionId?: string` |
| `POST /sql/sandbox/execute` | `sessionId?: string` |

When `sessionId` is present, all playground operations MUST scope to the session schema. When omitted, legacy global playground behavior applies.

---

## Internal module exports

| Export | Purpose |
| ------ | ------- |
| `ProvisionExperimentSessionUseCase` | Create or reuse session |
| `GetExperimentSessionUseCase` | Resolve session by id |
| `TeardownExperimentSessionUseCase` | Drop schema and clear metadata |
| `ExperimentIsolationModule` | NestJS module import |

---

## Integration rules

1. **Lab Shell flow**: provision session → prepare dataset with `sessionId` → poll dataset ready → run SQL with `sessionId`.
2. **Experiment Runner** MUST reject run when `sessionId` is provided but session status ≠ `ready`.
3. **Dataset Loader** MUST use session-scoped status keys when `sessionId` is present.
4. **Concurrent sessions** MUST NOT share playground schema namespace.
5. **Platform DB** MUST NOT store playground row data — session metadata in Redis only.

---

## Observability

```typescript
{
  event: 'experiment_session';
  phase: 'provision_started' | 'provision_completed' | 'provision_failed' |
         'teardown_started' | 'teardown_completed' | 'teardown_failed' | 'expired';
  sessionId: string;
  trackSlug: string;
  labSlug: string;
  schemaName?: string;
  durationMs?: number;
  errorCode?: string;
}
```

No SQL text or client tokens in logs.

---

## Auth

Bearer JWT optional. `clientSessionToken` is required regardless of auth state. When authenticated, `userId` from JWT included in audit logs.
