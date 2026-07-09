# Data Model: Worker Queue Foundation

**Feature**: 012-worker-queue-foundation

## Entities

### BackgroundJob

Unified status snapshot for any foundation-managed job.

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `id` | UUID | yes | Public job identifier |
| `jobType` | JobType | yes | Selects queue + handler semantics |
| `userId` | string \| null | no | Authenticated owner |
| `sessionId` | string \| null | no | Experiment session when applicable |
| `status` | JobStatus | yes | Lifecycle state |
| `payloadSummary` | object | no | Non-sensitive summary for status responses (e.g. dataset identity, profile) |
| `createdAt` | ISO datetime | yes | Enqueue time |
| `startedAt` | ISO datetime | no | Worker start |
| `completedAt` | ISO datetime | no | Terminal time |
| `attemptCount` | number | yes | Starts at 0; increments on worker attempts |
| `maxAttempts` | number | yes | From queue retry policy |
| `failureReason` | JobFailureReason | no | When `failed` |
| `failureMessage` | string | no | Learner-safe hint |
| `deadLetteredAt` | ISO datetime | no | Set when retries exhausted |

**Storage (MVP)**: Redis string/hash at `jobs:status:{id}` with configurable TTL (default 24h). Secondary index optional: `jobs:session:{sessionId}` set of job IDs for teardown cancel.

### JobType (enum)

| Value | Queue name (default) | Handler |
| ----- | -------------------- | ------- |
| `benchmark` | `benchmark-jobs` | Existing k6 executor path |
| `dataset-reset` | `dataset-reset-jobs` | Teardown + seed reset path |

Future: `sql-execution` (out of scope).

### JobStatus (enum)

| Value | Meaning |
| ----- | ------- |
| `queued` | Accepted, waiting for worker |
| `running` | Worker actively processing |
| `completed` | Finished successfully |
| `failed` | Terminal error (may be dead-lettered) |
| `cancelled` | Session teardown / internal cancel |

### JobFailureReason (enum)

| Value | When |
| ----- | ---- |
| `VALIDATION_ERROR` | Malformed payload / non-retryable validation |
| `SESSION_UNAVAILABLE` | Session missing or torn down |
| `TIMEOUT` | Exceeded job timeout |
| `EXECUTION_ERROR` | Handler/runtime failure |
| `STORAGE_ERROR` | Could not persist status/completion |
| `QUEUE_UNAVAILABLE` | Enqueue-time queue/Redis failure (usually no job row) |
| `RATE_LIMITED` | Enqueue rejected by rate limit (no job created) |

### RetryPolicy

Config-driven per queue (not persisted per job beyond `maxAttempts` snapshot).

| Field | Notes |
| ----- | ----- |
| `maxAttempts` | e.g. benchmark 2, dataset-reset 3 |
| `backoff` | fixed or exponential delay ms |

### DeadLetterRecord (logical)

Not a separate HTTP resource. Represented by:

- Job status `failed` with `deadLetteredAt` set
- Structured log/metric event `job_dead_lettered`

| Field | Notes |
| ----- | ----- |
| `jobId` | |
| `jobType` | |
| `failureReason` | |
| `attemptCount` | |
| `sessionId` / `userId` | when available |

### QueuePayload (BullMQ)

Minimal execution payload; status lives in JobStore.

| Field | Notes |
| ----- | ----- |
| `jobId` | Correlates to BackgroundJob |
| `jobType` | Redundant safety check |
| `sessionId` | |
| `userId` | optional |
| `body` | Type-specific payload (benchmark target/profile OR reset family/tier/version) |

## Relationships

```text
User 1──* BackgroundJob
ExperimentSession 1──* BackgroundJob
JobType 1──* BackgroundJob
BackgroundJob ──(on dead letter)──▶ logs/metrics (operator)
```

## State transitions

```text
queued → running → completed
queued → running → failed
queued → cancelled
running → cancelled
queued → failed          (non-retryable before/at start)
failed → (dead letter marker when attempts exhausted)
```

Invalid: `completed` → any; `cancelled` → `running`.

## Validation rules

- `jobType` must be a registered foundation type.
- Status transitions must be monotonic toward terminal states except retry loops that stay in `running`/`queued` per BullMQ semantics while `attemptCount` increases.
- Ownership: status read requires matching `userId` (or session ownership rules consistent with experiment isolation).
- Dataset-reset and benchmark enqueue must create JobStore row **before** or atomically with queue add; on queue failure after store write, mark `failed`/`QUEUE_UNAVAILABLE` or delete row — no ambiguous half-created jobs (FR-010).
