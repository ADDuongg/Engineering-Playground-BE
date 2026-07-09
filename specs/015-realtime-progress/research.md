# Research: Realtime Progress

**Feature**: 015-realtime-progress | **Date**: 2026-07-09

## R1 — Push transport

**Decision**: NestJS **SSE** (`text/event-stream`) on `GET /api/v1/benchmarks/:jobId/progress`. Bypass `ResponseEnvelopeInterceptor` for this route (passthrough / exclude).

**Rationale**: Spec requires push-only in-run progress. ARCHITECTURE lists SSE before WebSocket. One-way server→client fits progress. No new socket.io dependency.

**Alternatives considered**:
- WebSocket / socket.io — bidirectional overhead; not needed for progress-only.
- Long-poll / status polling as progress — rejected by clarification (push-only).
- gRPC streaming — not used elsewhere in the monorepo.

---

## R2 — Cross-process bridge (worker → API)

**Decision**: Redis **latest snapshot** key + **PUBLISH** on a per-job channel. Worker writes/publishes; API SSE use case reads latest on connect then subscribes to channel until terminal or client disconnect.

**Rationale**: `EventEmitter2` is in-process only; `benchmark-worker` is a separate Nest `ApplicationContext`. Redis already backs `JobStore` and dataset prep status.

**Alternatives considered**:
- EventEmitter2 only — cannot reach API process.
- BullMQ progress events — couples progress to queue internals; weaker reconnect snapshot.
- SSE loop polling Redis without pub/sub — works but adds up to 1s lag and busy-wait; pub/sub preferred with snapshot for reconnect.

---

## R3 — Ephemeral storage shape

**Decision**: Key `benchmark:progress:{jobId}` → JSON `BenchmarkProgressSnapshot`; TTL aligned with job status TTL (or shorter, e.g. job TTL). Overwrite on each tick (latest-only). Optional short TTL after terminal for reconnect-after-completion, then expire.

**Rationale**: Clarification: ephemeral only; no Platform DB history. Mirrors `DatasetPreparationStatusStore`.

**Alternatives considered**:
- Persist ticks to Platform DB — rejected by clarification.
- Rolling buffer of N ticks — ops-only; out of MVP scope.

---

## R4 — Interim observations from k6

**Decision**: Extend `K6BenchmarkExecutor` to accept an `onProgress` callback (~1 Hz). Prefer k6 `--out json=<file>` (or stdout NDJSON) and tail aggregate metrics (`http_reqs`, `http_req_duration`, `http_req_failed`) into provisional catalog fields. Throttle publishes to ≤ 1/sec per job.

**Rationale**: Today `execFileAsync` + `--summary-export` is end-of-run only; without interim output, partial metrics cannot be real. Wall-clock fake RPS would violate learning-first / backend-truth principles.

**Alternatives considered**:
- Phase/elapsed only until completion — fails backlog “partial metrics preview” and clarification B.
- Separate metrics sidecar HTTP — overkill for MVP.
- k6 cloud / external streaming — out of scope.

**Mapping (provisional subset)**:

| Preview field | Catalog key | Interim source |
| ------------- | ----------- | -------------- |
| Current RPS | `achieved_rps` | `http_reqs` rate (or count/elapsed) |
| Latency | `latency_avg_ms` | `http_req_duration` avg when available |
| Error | `error_rate_pct` | `http_req_failed` rate × 100 when available |

Omit fields when not yet measurable (FR-012). Mark each metric `provisional: true` (or wrap in `partialMetrics` with `provisional: true` on the snapshot).

---

## R5 — Reconnect / missing snapshot

**Decision**: On SSE connect: (1) ownership check via `JobStore`; (2) if latest progress exists → emit it; (3) else if job non-terminal → **seed** `{ phase, elapsedMs }` from job `status` / `createdAt` / `startedAt`, omit RPS/partial; (4) if job terminal → emit terminal signal and close; (5) subscribe to Redis channel for further updates.

**Rationale**: Clarification A for missing ephemeral progress. One-time status seed is not ongoing progress-via-polling.

**Alternatives considered**:
- Fail until next tick — worse UX after worker/API restart.
- Block until full RPS available — hangs UI.

---

## R6 — Terminal handoff

**Decision**: On completed/failed, worker writes snapshot with `terminal: true` (phase = completed|failed), publishes once, then SSE closes. **No** final `metrics[]` on the stream. Client uses `GET /benchmarks/:jobId` + metrics APIs.

**Rationale**: Clarification B; keeps Benchmark Metrics as sole final Metric Contract owner.

**Alternatives considered**:
- Embed finals on terminal event — couples features and races collection.
- Keep stream open until metrics ready — turns progress into metrics waiter.

---

## R7 — Ownership & auth

**Decision**: Same as status: `@Public()` + optional JWT; require `callerUserId === job.userId` OR `callerSessionId === job.sessionId` (query `sessionId`). Else 403.

**Rationale**: Spec assumes Benchmark Runner ownership rules.

---

## R8 — Queued-phase progress

**Decision**: On enqueue (or first SSE connect while queued), publish/seed phase `queued` with elapsed since `createdAt`. Worker upgrades to `running` on `markRunning` before k6 starts. No RPS/partial while queued.

**Rationale**: FR-001 requires phase + elapsed while queued/running; RPS only after load starts.

---

## R9 — Update cadence

**Decision**: Default **1 Hz** max publish per job (config `benchmark.progressIntervalMs`, default 1000). Drop intermediate ticks if faster.

**Rationale**: Spec assumption “about once per second”; satisfies FR-010 / SC-005.

---

## R10 — Module ownership

**Decision**: Implement inside `BenchmarkRunnerModule` + worker processor; shared types under `src/shared/benchmark/`. Do not create `RealtimeProgressModule` or touch Metrics Pipeline collection.

**Rationale**: Progress is job-lifecycle UX; Metrics Pipeline owns finals only.
