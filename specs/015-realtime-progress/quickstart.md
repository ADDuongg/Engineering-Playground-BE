# Quickstart: Realtime Progress

**Feature**: 015-realtime-progress  
**Contracts**: [realtime-progress-service.md](./contracts/realtime-progress-service.md)  
**Data model**: [data-model.md](./data-model.md)

## Prerequisites

- API + Redis + playground DB running
- `pnpm dev:benchmark-worker` running
- Authenticated learner (or valid experiment `sessionId`)
- Experiment session **READY** with a valid SQL target (same as Benchmark Runner)

## Validation scenarios

### 1. Live progress while running

1. Enqueue a short benchmark (`POST /api/v1/benchmarks`, e.g. 100 RPS / 10s).
2. Open SSE: `GET /api/v1/benchmarks/:jobId/progress?sessionId=...` (or Bearer token).
3. Expect successive `event: progress` frames with `phase`, `elapsedMs`, and (after load starts) `currentRps`.
4. When observations exist, expect `partialMetrics` with provisional `achieved_rps` and optionally latency/error — all `provisional: true`.
5. Confirm the client is **not** polling `GET /benchmarks/:jobId` for progress.

### 2. Reconnect mid-run

1. During a running job, disconnect the SSE client.
2. Reconnect within a few seconds.
3. Expect an immediate snapshot (latest Redis or status-seeded phase/elapsed), then further `progress` events if still running.
4. Resume within ≤ 3s under nominal conditions (SC-002).

### 3. Terminal handoff (no finals on stream)

1. Keep SSE open until job finishes.
2. Expect `event: terminal` with `terminal: true` and **no** final Metric Contract array; stream closes.
3. Call `GET /api/v1/benchmarks/:jobId` (and/or `/metrics`) for finals / `metricsStatus`.

### 4. Subscribe after completion

1. Complete a job without an open SSE.
2. Open `GET .../progress`.
3. Expect immediate `terminal` (or equivalent) and close — no hang.

### 5. Unauthorized

1. Request another user’s `jobId` progress stream.
2. Expect `403 FORBIDDEN` (or SSE `error` with forbidden) — SC-006.

### 6. Queued phase

1. Subscribe immediately after enqueue (before worker picks up).
2. Expect `phase: 'queued'`, queue-based `elapsedMs`, no invented RPS/partial metrics.

## Suggested commands

```bash
pnpm test -- --testPathPattern='observe-benchmark-progress|benchmark-progress.store|k6-progress'
pnpm exec jest --config ./test/jest-e2e.json --testPathPattern='realtime-progress' --no-coverage
```

Manual SSE (example):

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/benchmarks/$JOB_ID/progress"
```

## Success checklist

- [x] SC-001: Running jobs under observation emit phase/elapsed and RPS after load starts
- [x] SC-002: Reconnect resumes within 3s
- [x] SC-003: Terminal closes stream without finals; status/metrics used for charts
- [x] SC-004: Partial metrics are backend-provided only
- [x] SC-005: Progress via SSE only (not status polling)
- [x] SC-006: Cross-user observe denied
