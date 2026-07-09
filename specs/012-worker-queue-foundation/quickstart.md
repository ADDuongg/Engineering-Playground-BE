# Quickstart: Worker Queue Foundation

**Feature**: 012-worker-queue-foundation

## Prerequisites

- Platform API running (`pnpm dev`)
- Redis available
- Workers running:
  - `pnpm dev:benchmark-worker`
  - `pnpm dev:dataset-reset-worker` (added by this feature)
- Active experiment session + prepared dataset (`commerce` / `100k` / `v1`)
- Auth token for a learner

## Environment

```bash
# Shared / per-queue (defaults shown)
JOB_STATUS_TTL_SECONDS=86400
DATASET_RESET_QUEUE_NAME=dataset-reset-jobs
DATASET_RESET_WORKER_CONCURRENCY=2
DATASET_RESET_JOB_TIMEOUT_SECONDS=600
DATASET_RESET_MAX_ATTEMPTS=3
# Benchmark queue keys remain; producer uses shared foundation
```

## 1. Enqueue dataset reset (async)

```bash
curl -s -X POST http://localhost:3001/api/v1/datasets/reset \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sessionId": "'"$SESSION_ID"'",
    "family": "commerce",
    "tier": "100k",
    "version": "v1"
  }' | jq
```

Expect `202` with `jobId` and `status: "queued"` within 2 seconds (not a completed reset payload).

## 2. Poll shared job status

```bash
curl -s http://localhost:3001/api/v1/jobs/$JOB_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

Observe: `queued` → `running` → `completed` (or `failed` with categorized `failureReason`).

## 3. Benchmark still works via foundation

```bash
curl -s -X POST http://localhost:3001/api/v1/benchmarks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ ... }' | jq

curl -s http://localhost:3001/api/v1/jobs/$BENCH_JOB_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 4. Queue unavailable

Stop Redis (or block queue connection). Enqueue reset/benchmark → expect `503` / `QUEUE_UNAVAILABLE` within 2s.  
Run a non-queue operation (e.g. `GET /auth/me` or SQL experiment if configured) → still succeeds.

## 5. Session teardown cancels jobs

Enqueue a long reset/benchmark, then teardown the experiment session. Poll job → `cancelled` (or terminal failed with session-unavailable if already mid-flight per implementation rules). Worker must not leave the job running indefinitely against a missing session.

## 6. Dead letter (operator)

Force a permanent handler failure (test hook or invalid payload after enqueue). After max attempts, logs/metrics include `job_dead_lettered` with `jobType`, `jobId`, `failureReason`, `attemptCount`. Job status remains `failed` with `deadLetteredAt` when exposed.

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------- |
| Stuck `queued` | Dataset-reset or benchmark worker not running |
| `503 QUEUE_UNAVAILABLE` | Redis down |
| Reset still sync-completes | Migration incomplete — reset UseCase must enqueue only |
| `403` on `GET /jobs/:id` | Job owned by another user |
