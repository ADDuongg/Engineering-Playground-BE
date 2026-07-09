# Quickstart: Benchmark Runner

**Feature**: 011-benchmark-runner

## Prerequisites

- Platform API running (`pnpm dev`)
- Redis available (queue + job status)
- k6 installed locally (`brew install k6` or see https://k6.io/docs/get-started/installation/)
- Benchmark worker running (`pnpm dev:benchmark-worker` — added with this feature)
- Active experiment session (via Experiment Isolation provision endpoint)
- Dataset prepared (`commerce` / `100k` / `v1`)

## Environment

```bash
# BullMQ / benchmark
BENCHMARK_QUEUE_NAME=benchmark-jobs
BENCHMARK_WORKER_CONCURRENCY=2
BENCHMARK_MAX_INFLIGHT_PER_SESSION=1
BENCHMARK_JOB_TTL_SECONDS=86400
BENCHMARK_K6_BINARY=k6
BENCHMARK_INTERNAL_BASE_URL=http://localhost:3000
```

## 1. Provision experiment session

```bash
curl -s -X POST http://localhost:3000/experiment-sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "dataset": { "family": "commerce", "tier": "100k", "version": "v1" },
    "context": { "labSlug": "benchmark-lab" }
  }' | jq
```

Save `sessionId` from response.

## 2. Enqueue benchmark

```bash
curl -s -X POST http://localhost:3000/benchmarks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sessionId": "'"$SESSION_ID"'",
    "profile": { "rps": 100, "durationSeconds": 10 },
    "target": {
      "sql": "SELECT id FROM users LIMIT 10",
      "dataset": { "family": "commerce", "tier": "100k", "version": "v1" }
    },
    "context": { "labSlug": "benchmark-lab" }
  }' | jq
```

Expect `202` with `jobId` and `status: "queued"` within 2 seconds.

## 3. Poll status

```bash
curl -s http://localhost:3000/benchmarks/$JOB_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

Observe transitions: `queued` → `running` → `completed` (or `failed` with `failureReason`).

## 4. Verify isolation

While a 60s / 5000 RPS job runs, confirm another user's SQL experiment still succeeds:

```bash
curl -s -X POST http://localhost:3000/experiments/sql/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OTHER_TOKEN" \
  -d '{ ... }' | jq '.success'
```

## 5. Rate limit check

Submit more than `RATE_LIMIT_BENCHMARK_ENQUEUE` jobs within the window; expect `429 RATE_LIMITED`.

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------- |
| `503 QUEUE_UNAVAILABLE` | Redis down or worker not connected |
| `404 SESSION_UNAVAILABLE` | Session expired or invalid |
| `failed` + `EXECUTION_ERROR` | k6 not installed or target URL unreachable |
| Stuck in `queued` | Benchmark worker process not running |
