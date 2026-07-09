# Data Model: Benchmark Runner

**Feature**: 011-benchmark-runner

## Entities

### BenchmarkJob

Represents one schedulable load test.

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `id` | UUID | yes | Public job identifier returned to client |
| `userId` | string \| null | no | Authenticated owner; null if session-only |
| `sessionId` | string | yes | Experiment session scope |
| `status` | BenchmarkJobStatus | yes | Lifecycle state |
| `profile` | BenchmarkProfile | yes | RPS tier + duration |
| `target` | BenchmarkTarget | yes | SQL + dataset reference |
| `createdAt` | ISO datetime | yes | Enqueue time |
| `startedAt` | ISO datetime | no | When worker began k6 |
| `completedAt` | ISO datetime | no | Terminal transition time |
| `failureReason` | BenchmarkFailureReason | no | Set when status = failed |
| `failureMessage` | string | no | Learner-safe hint |
| `k6Summary` | object | no | Raw k6 end-of-test summary JSON (handoff to Metrics Pipeline) |

**Storage (MVP)**: Redis hash/string at `benchmark:job:{id}` with TTL (e.g. 24h).

### BenchmarkProfile

Validated load configuration.

| Field | Type | Allowed values |
| ----- | ---- | -------------- |
| `rps` | number | 100, 500, 1000, 5000 |
| `durationSeconds` | number | 10, 30, 60 |

Platform config may extend allowed sets without schema change.

### BenchmarkTarget

| Field | Type | Notes |
| ----- | ---- | ----- |
| `sql` | string | Pre-validated SELECT (sandbox classifier) |
| `parameters` | unknown[] | Query parameters |
| `dataset` | `{ family, tier, version }` | Same shape as experiment runner |
| `context` | `{ trackSlug?, labSlug? }` | Audit / metrics enrichment |

### BenchmarkJobStatus (enum)

| Value | Meaning |
| ----- | ------- |
| `queued` | Accepted, waiting for worker |
| `running` | k6 subprocess active |
| `completed` | Finished successfully |
| `failed` | Terminal error |
| `cancelled` | Session torn down or superseded before/during run |

### BenchmarkFailureReason (enum)

| Value | When |
| ----- | ---- |
| `VALIDATION_ERROR` | Invalid profile or SQL |
| `SESSION_UNAVAILABLE` | Session missing or torn down |
| `TIMEOUT` | Exceeded job or k6 time bounds |
| `EXECUTION_ERROR` | k6 non-zero exit or target errors |
| `STORAGE_ERROR` | Could not persist completion snapshot |
| `QUEUE_UNAVAILABLE` | BullMQ/Redis queue failure on enqueue |
| `RATE_LIMITED` | Enqueue rejected by rate limit ( surfaced at API, job not created ) |

## Relationships

```text
User/Session 1──* BenchmarkJob
ExperimentSession 1──* BenchmarkJob
BenchmarkJob 1──1 BenchmarkProfile
BenchmarkJob 1──1 BenchmarkTarget
BenchmarkJob ──(on completed)──▶ Metrics Pipeline (async handoff)
```

## State transitions

```text
[enqueue success] → queued
queued → running (worker pickup)
running → completed (k6 success)
running → failed (k6 error, timeout, session lost)
queued → cancelled (session teardown)
running → failed | cancelled (session teardown mid-run)
```

## Validation rules

- `rps` and `durationSeconds` MUST match configured allowlists.
- `sessionId` MUST resolve to an active experiment session at enqueue time.
- `sql` MUST pass sandbox statement classifier (SELECT-only for MVP benchmark labs).
- Job `id` MUST be unique.
- Status queries MUST enforce ownership: `userId` match OR `sessionId` match for anonymous session flows.

## Out of scope (this feature)

- Durable Platform DB table for benchmark history (Benchmark Metrics).
- Latency percentile aggregation (Benchmark Metrics).
- Realtime SSE progress events (Realtime Progress).
