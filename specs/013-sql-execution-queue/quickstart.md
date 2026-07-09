# Quickstart: SQL Execution Queue

**Feature**: 013-sql-execution-queue

## Prerequisites

- Platform API running (`pnpm dev`)
- Redis available
- SQL execution worker running: `pnpm dev:sql-execution-worker` (added by this feature)
- Active experiment session + prepared dataset (`commerce` / `100k` / `v1`)
- Auth token for a learner (`$TOKEN`), session id (`$SESSION_ID`)

## Environment

```bash
JOB_STATUS_TTL_SECONDS=86400
SQL_EXECUTION_QUEUE_NAME=sql-execution-jobs
SQL_EXECUTION_WORKER_CONCURRENCY=5        # align with playground pool capacity
SQL_EXECUTION_JOB_TIMEOUT_SECONDS=60
SQL_EXECUTION_MAX_ATTEMPTS=2
SQL_EXECUTION_BACKOFF_MS=1000
SQL_EXECUTION_MAX_INFLIGHT_PER_SESSION=1
```

## 1. Enqueue an interactive SQL run (async)

```bash
curl -s -X POST http://localhost:3001/api/v1/experiments/sql/runs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sessionId": "'"$SESSION_ID"'",
    "sql": "SELECT * FROM users WHERE email = $1",
    "parameters": ["abc@example.com"],
    "dataset": { "family": "commerce", "tier": "100k", "version": "v1" }
  }' | jq
```

Expect `202` with `{ jobId, jobType: "sql-execution", status: "queued", createdAt }` within 2 seconds (SC-001) — not the query rows.

## 2. Poll shared job status → completed result

```bash
curl -s http://localhost:3001/api/v1/jobs/$JOB_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

Observe `queued` → `running` → `completed`. On `completed`, `payloadSummary.executionResult` contains the rows + metrics (`truncated` flag when the row cap is hit).

## 3. Per-session in-flight de-duplication

Submit two runs for the same session back-to-back. The second returns `409 SQL_RUN_INFLIGHT_LIMIT` while the first is `queued`/`running`. After the first reaches a terminal state, a new run is accepted (SC-003).

## 4. Bounded concurrency

Enqueue more runs than `SQL_EXECUTION_WORKER_CONCURRENCY` across several sessions. Simultaneously executing queries never exceed the configured limit; excess runs stay `queued` and drain as capacity frees (SC-002).

## 5. Timeout → categorized failure

Enqueue a deliberately slow query (e.g. a large cross join) that exceeds the sandbox query timeout. The run finalizes `failed` with `failureReason: "TIMEOUT"` and an educational `failureMessage` (SC-005) — not an opaque hang.

## 6. Session teardown cancels in-flight runs

Enqueue a run, then `DELETE /api/v1/experiments/sessions/$SESSION_ID`. Poll the job → `cancelled`; the query never executes against the removed schema (SC-006).

## 7. Queue unavailable

Stop Redis. Enqueue a run → `503 QUEUE_UNAVAILABLE` within 2 seconds with no orphaned job (SC-007). A cache-only path (e.g. `GET /auth/me`) still succeeds.

## 8. Result parity with synchronous execution

For SELECT, EXPLAIN, and index create/drop, the queued `payloadSummary.executionResult` matches the synchronous `POST /experiments/sql/run` result (rows + metrics) for the same input, dataset, and session (SC-004).

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------- |
| Stuck `queued` | SQL execution worker not running |
| `503 QUEUE_UNAVAILABLE` | Redis down |
| `409 SQL_RUN_INFLIGHT_LIMIT` | A prior run for the session is still in flight |
| Double-charged rate limit | Worker re-charging quota — must run pre-authorized |
| Huge status payload | Row cap not enforced — bound result before embedding |
| `403` on `GET /jobs/:id` | Job owned by another user/session |
