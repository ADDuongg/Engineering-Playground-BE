# BACKLOG

Version: 1.5

Status: Active

Sources: [PRD.md](./PRD.md) · [ROADMAP.md](./ROADMAP.md) · [DOMAIN.md](../engineering/DOMAIN.md) · [SYSTEM_DESIGN.md](../engineering/SYSTEM_DESIGN.md) · [ARCHITECTURE.md](../engineering/ARCHITECTURE.md) · [ENGINEERING_GUIDE.md](../engineering/ENGINEERING_GUIDE.md)

**Scope**: This backlog is **backend-only** (NestJS API, workers, Platform DB, playground runtimes). Frontend UI (landing, browsers, Lab Shell, charts, admin dashboards) is owned by a separate FE team and is **out of scope** here. Backend features expose APIs and contracts the FE consumes — including **admin content APIs** (PRD §23 out-of-scope is UI dashboards, not admin write APIs).

---

## Domain hierarchy

Content is organized as **Track → Category → Lab → Experiment**.

| Level | Role |
| ----- | ---- |
| **Track** | Learning domain — **Phase 1:** Database/SQL · **Phase 2:** Caching & Concurrency |
| **Category** | Group within a Track (indexes, cache patterns, …) |
| **Lab** | Smallest learning unit; teaches one concept |
| **Experiment** | Input → Runtime Adapter → Metric Contract → (FE visualization) |

Each Track declares a **Runtime Adapter**, **Input Surface**, **Metric Catalog**, and **Visualization Kit** (metadata for FE). Backend owns adapters, metrics, and lab APIs.

Active backlog covers **Phase 1 and 2** only. MVP ships **Phase 1 — Database / SQL** first. Phase 4 (Frontend Performance Track) is out of scope for this BE backlog.

---

## How to use with Spec Kit

1. Scan **Phase → Epic → Feature** below; pick the highest-priority feature whose dependencies are **Done**.
2. Run `/speckit-specify` using the **Feature Name** and **Goal** as scope → creates `specs/[###-feature-name]/`.
3. Update **Spec Folder** and set **Status** to `Spec Ready` → `Implementing` → `Review` → `Done`.
4. Continue workflow: `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
5. Complete the feature **Checklist** and verify [Definition of Done](../../.specify/memory/constitution.md).

**Phase completion**: all features **Done** for the Phase's Track(s) + lab APIs documented + Runtime Adapter verified + tests passing + performance verified (ROADMAP §14).

**MVP target** (ROADMAP §4–5): **Phase 1 — Database / SQL** — P0/P1 through Benchmark Lab APIs + Learning Platform APIs + **Admin / Content Ops** (so later labs are content-driven) + Index / EXPLAIN / Offset lab backends.

**In-scope phases**: 1 (Database), 2 (Caching). Phases 3, 4, 5, 6 and Future epics are out of scope for this backlog.

**Priority legend**

| Priority | Meaning |
| -------- | ------- |
| P0 | Core infrastructure required before any lab |
| P1 | Important learning features |
| P2 | Enhancements |
| P3 | Nice-to-have |

---

# Phase 1 — Track: Database / SQL

Theme: Core database labs, PostgreSQL Runtime Adapter, and learning platform foundation (ROADMAP §6).

## Epic: Runtime Adapters (PostgreSQL)

Core experiment execution via Playground PostgreSQL Runtime Adapter (SYSTEM_DESIGN §4, ENGINEERING_GUIDE §8, DOMAIN §Runtime Adapter).

---

## Feature: Dataset Loader

Status: Done  
Priority: P0  
Depends On:

- None

Goal:  
Load platform-provided datasets into Playground PostgreSQL so every Database Track experiment starts from a known, reproducible state.

Deliverables:

- Load predefined datasets (users, orders, products, logs, payments)
- Support dataset versioning and size tiers (100K / 1M / 10M)
- Prepare deterministic playground state per experiment session
- Expose dataset metadata to labs without user uploads (PRD §14)

Spec Folder:

- [specs/003-dataset-loader](../../specs/003-dataset-loader/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Dataset Reset

Status: Done  
Priority: P0  
Depends On:

- Dataset Loader

Goal:  
Reset Playground PostgreSQL to a clean baseline so Database Track experiments remain isolated and repeatable (DOMAIN §Experiment, ENGINEERING_GUIDE §7).

Deliverables:

- Reset playground schema and seed data on demand
- Guarantee no cross-experiment state leakage
- Complete reset within acceptable time bounds for lab UX
- Audit reset events for troubleshooting

Spec Folder:

- [specs/004-dataset-reset](../../specs/004-dataset-reset/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Experiment Runner

Status: Done  
Priority: P0  
Depends On:

- Dataset Loader
- SQL Sandbox & Resource Limits

Goal:  
Execute user SQL safely inside the PostgreSQL Runtime Adapter and return structured execution results (ROADMAP §Runtime Adapters — Experiment Runner / SQL Sandbox).

Deliverables:

- Run parameterized SQL against Playground PostgreSQL only
- Enforce query timeout and resource limits (PRD §19)
- Return rows, timing, and error details with actionable messages (ENGINEERING_GUIDE §20)
- Deterministic, repeatable execution per experiment rules

Spec Folder:

- [specs/005-experiment-runner](../../specs/005-experiment-runner/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: SQL Execution Queue

Status: Done  
Priority: P0  
Depends On:

- Experiment Runner
- Worker Queue Foundation
- SQL Sandbox & Resource Limits

Goal:  
Route interactive SQL experiment execution through an async job queue so API requests stay non-blocking under concurrent load and playground connection pressure is bounded (SYSTEM_DESIGN §18, ENGINEERING_GUIDE §14).

Deliverables:

- Enqueue Experiment Runner jobs via BullMQ instead of synchronous handler execution (`POST /experiments/sql/runs`)
- Job lifecycle for SQL runs: queued → running → completed → failed → cancelled
- Per-session job deduplication (reject duplicate in-flight runs for same session)
- Configurable worker concurrency aligned with playground pool capacity
- Completed results (rows + metrics) embedded in the shared job-status payload (`GET /jobs/:jobId`)
- Queue depth and wait-time metrics for observability
- Timeout and cancellation propagated from sandbox limits to queued jobs
- Fast-path sync execution deferred (out of scope for this feature)

Spec Folder:

- [specs/013-sql-execution-queue](../../specs/013-sql-execution-queue/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Explain Runner

Status: Done  
Priority: P0  
Depends On:

- Experiment Runner

Goal:  
Run `EXPLAIN` / `EXPLAIN ANALYZE` safely and return planner output for visualization (ROADMAP §Explain Analyze Lab).

Deliverables:

- Execute explain commands within sandbox limits
- Parse execution tree, cost, rows, planning time, execution time
- Return backend-normalized explain payload (never raw-only strings to UI)
- Safe execution without side effects on platform data

Spec Folder:

- [specs/007-explain-runner](../../specs/007-explain-runner/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Metrics Pipeline

Status: Done  
Priority: P0  
Depends On:

- Explain Runner
- Experiment Runner

Goal:  
Aggregate experiment outputs into backend-owned **Metric Contract** objects consumed by visualization and labs (DOMAIN §Metric Contract, PRD §11).

Deliverables:

- Collect Database Track metrics: execution time, rows scanned/returned, index usage, plan summary
- Normalize metrics via shared Metric Contract (`key`, `label`, `unit`, `value`, `group`)
- Persist metrics history for compare-before/after flows
- Never require frontend to derive engineering metrics

Spec Folder:

- [specs/008-metrics-pipeline](../../specs/008-metrics-pipeline/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: SQL Sandbox & Resource Limits

Status: Done  
Priority: P0  
Depends On:

- None

Goal:  
Enforce sandbox boundaries so only allowed SQL runs with bounded cost (PRD §19–20, ENGINEERING_GUIDE §12).

Deliverables:

- Parameterized queries only; block dangerous statements
- Per-query timeout and resource caps
- Rate limiting for expensive operations (delegated to Per-User Rate Limit feature)
- Structured sandbox violation errors for learners

Spec Folder:

- [specs/002-sql-sandbox](../../specs/002-sql-sandbox/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Per-User Rate Limit

Status: Done  
Priority: P0  
Depends On:

- Authentication
- SQL Sandbox & Resource Limits

Goal:  
Replace global-only API throttling with per-user execution limits so one learner cannot exhaust shared playground capacity and fair-use policies apply per identity (PRD §20, ENGINEERING_GUIDE §12).

Deliverables:

- Rate limits keyed by authenticated user ID (fallback: session ID for anonymous lab access where allowed)
- Separate limit tiers for operation types: SQL run, EXPLAIN, benchmark enqueue, dataset reset
- Redis-backed sliding window or token bucket (shared with existing Redis infrastructure)
- Configurable limits via environment or platform settings (e.g. 30 SQL runs/min/user, 10 EXPLAIN/min/user)
- Structured `RATE_LIMIT_EXCEEDED` errors with retry-after guidance for learners
- Global safety ceiling retained as backstop (not sole throttle)
- Metrics: rate-limit hits per user, per operation type, per endpoint
- Admin override or elevated limits for internal/test accounts (optional, feature-flagged)

Spec Folder:

- [specs/010-per-user-rate-limit](../../specs/010-per-user-rate-limit/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Experiment Isolation

Status: Done  
Priority: P0  
Depends On:

- Dataset Loader
- Dataset Reset

Goal:  
Ensure each experiment session operates in an isolated runtime context for its Track (SYSTEM_DESIGN §4, ENGINEERING_GUIDE §8).

Deliverables:

- Session-scoped runtime identity per user experiment
- No dependency on prior experiment executions
- Clear separation from Platform DB (permanent data)
- Database Track uses Playground PostgreSQL; other Tracks use their own adapters when added
- Recovery path when isolation fails

Spec Folder:

- [specs/006-experiment-isolation](../../specs/006-experiment-isolation/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Epic: Benchmark Infrastructure

Async load-test execution separate from HTTP request path (SYSTEM_DESIGN §Benchmark Runner, ENGINEERING_GUIDE §13–14).

---

## Feature: Benchmark Runner

Status: Done  
Priority: P0  
Depends On:

- Experiment Runner
- Metrics Pipeline

Goal:  
Schedule and execute benchmarks (e.g. k6) asynchronously without blocking API requests (ROADMAP §Benchmark).

Deliverables:

- Queue benchmark jobs via worker path (never synchronous in handlers)
- Support configurable RPS tiers (100 / 500 / 1000 / 5000) and durations (PRD §13)
- Track benchmark lifecycle (queued → running → completed → failed)
- Isolate benchmark load from platform stability

Spec Folder:

- [specs/011-benchmark-runner](../../specs/011-benchmark-runner/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Benchmark Metrics

Status: Done  
Priority: P1  
Depends On:

- Benchmark Runner

Goal:  
Collect and expose throughput, latency, and error metrics from completed benchmarks (PRD §13, ROADMAP §Benchmark).

Deliverables:

- Latency, P95, P99, RPS, throughput, error rate aggregates
- Store benchmark results for history and comparison
- Backend-owned metrics API for FE charts
- Consistent metric units across all benchmark labs

Spec Folder:

- [specs/014-benchmark-metrics](../../specs/014-benchmark-metrics/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Realtime Progress

Status: Done  
Priority: P2  
Depends On:

- Benchmark Runner

Goal:  
Stream benchmark progress (SSE/API) for FE clients while long-running load tests execute.

Deliverables:

- Live progress indicator (phase, elapsed time, current RPS)
- Partial metrics preview during run
- Graceful handling of disconnect and completion states
- No polling overload on API

Spec Folder:

- [specs/015-realtime-progress](../../specs/015-realtime-progress/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Epic: Platform Infrastructure

Cross-cutting platform services on permanent Platform DB (SYSTEM_DESIGN §Platform Database). Placeholders — remain Todo until prioritised.

---

## Feature: Settings

Status: Todo  
Priority: P2  
Depends On:

- Authentication

Goal:  
Persist user and platform settings without mixing playground experiment state.

Deliverables:

- User preference storage (theme, locale, accessibility)
- Platform-default settings schema
- Settings API with validation and authorization
- Settings excluded from playground reset

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Feature Flags

Status: Todo  
Priority: P2  
Depends On:

- Authentication

Goal:  
Toggle labs and platform capabilities safely during phased rollout.

Deliverables:

- Flag definitions for labs and experimental features
- Runtime evaluation without redeploy for supported flags
- Admin-safe defaults for MVP/Beta/Public milestones
- Audit trail when flags change behavior

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Audit Log

Status: Todo  
Priority: P2  
Depends On:

- Authentication

Goal:  
Record security-relevant and experiment actions for compliance and debugging (PRD §20).

Deliverables:

- Append-only audit events (auth, reset, benchmark, admin actions)
- Queryable audit log with request ID correlation
- Retention policy aligned with platform rules
- No sensitive data leakage in log payloads

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: File Storage

Status: Todo  
Priority: P2  
Depends On:

- Authentication

Goal:  
Provide controlled storage for platform assets (not user dataset uploads in MVP).

Deliverables:

- Store static lab assets and generated exports
- Access control per user/platform role
- No arbitrary file upload surface in MVP
- Integration point for future custom datasets (PRD §Future)

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Learning Platform

Backend APIs for auth, Track/lab catalog metadata, progress, and quizzes across Tracks (PRD §7, §10, ROADMAP §Platform Foundation / Learning System). UI discovery surfaces are FE-owned. Admin write APIs live in **Admin / Content Ops** below.

---

## Feature: Track Registry

Status: Done  
Priority: P0  
Depends On:

- None

Goal:  
Define and store Track metadata on Platform DB so labs, browsers, and runners resolve the correct Runtime Adapter, Input Surface, Metric Catalog, and Visualization Kit (DOMAIN §Track).

Deliverables:

- Track entity: slug, name, description, status (active / coming-soon)
- Per-Track config: runtime adapter type, input surface type, metric catalog reference
- Seed MVP with Database / SQL Track
- API to list Tracks for browser and lab catalog

Spec Folder:

- [specs/001-track-registry](../../specs/001-track-registry/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Authentication

Status: Done  
Priority: P0  
Depends On:

- None

Goal:  
Secure user access with register, login, session refresh, and profile (ROADMAP §Authentication, MVP §Login).

Deliverables:

- Register and login flows
- JWT access tokens and refresh token rotation
- Profile endpoint (`/auth/me`)
- Logout and token revocation
- Standard API response envelope on all auth endpoints

Spec Folder:

- [specs/009-authentication](../../specs/009-authentication/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Feature: Progress Tracking

Status: Done  
Priority: P1  
Depends On:

- Authentication

Goal:  
Track completed labs and learning path progress per Track via Platform APIs (ROADMAP §Progress, PRD §16).

Deliverables:

- Completed labs registry per user on Platform DB
- Learning path / sequence API within each Track
- Progress read APIs for FE catalog and detail surfaces
- Events emitted on lab completion (ENGINEERING_GUIDE §16)

Spec Folder:

- [specs/016-progress-tracking](../../specs/016-progress-tracking/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented


---

## Feature: Quiz Engine

Status: Done  
Priority: P1  
Depends On:

- Progress Tracking

Goal:  
Validate learning after experiments with per-lab quizzes (DOMAIN §Lab, PRD §9).

Deliverables:

- Quiz definition per lab
- Submit answers and score calculation
- Store quiz scores on Platform DB
- Gate progress updates on quiz completion where required

Spec Folder:

- [specs/017-quiz-engine](../../specs/017-quiz-engine/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

Notes:

- Learner-facing quiz APIs only; admin create/update of quiz definitions is **Quiz Admin CRUD**

---

## Epic: Admin / Content Ops

Backend admin APIs so operators manage Tracks, Labs, guided lab flows, quizzes, and users without redeploying seed/hardcoded content. FE admin UI is out of scope (PRD §23). Prefer `/api/v1/admin/*` + `Role.ADMIN`. Do this **before** additional Database Track Labs so Explain / Offset content can be authored via APIs.

---

## Feature: Admin AuthZ

Status: Todo  
Priority: P1  
Depends On:

- Authentication

Goal:  
Enforce admin-only access for content and user management APIs using the existing `Role.ADMIN` claim (no separate admin identity system in MVP).

Deliverables:

- Admin role guard / decorator reusable across admin controllers
- Reject non-admin callers with a clear forbidden response on `/api/v1/admin/*`
- Document how to promote a user to admin in local/dev (seed or one-off SQL; full User Admin may follow)
- Do not expose admin capabilities on learner routes

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Track & Lab Admin CRUD

Status: Todo  
Priority: P1  
Depends On:

- Admin AuthZ
- Track Registry
- Progress Tracking

Goal:  
Let admins create and update Track and Lab catalog metadata on Platform DB so new labs can be registered without migration-only seeds.

Deliverables:

- Admin CRUD (or create/update/list) for Tracks: slug, name, description, status, display order, runtime/input/metric/viz config
- Admin CRUD for Labs under a Track: slug, title, description, sequence order, active/coming-soon (or equivalent)
- Validation: unique slugs, stable ordering, no playground DB writes
- Learner list/detail APIs continue to read the same Platform tables

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Lab Flow Admin

Status: Todo  
Priority: P1  
Depends On:

- Admin AuthZ
- Track & Lab Admin CRUD
- Index Playground

Goal:  
Persist and manage ordered guided steps per lab (e.g. Index Playground: run SQL → explain → create index → re-run → quiz) so lab summary is content-driven instead of hardcoded TypeScript.

Deliverables:

- Platform DB model for lab guided steps: order, title, instruction, action type, optional payload (recommended SQL/DDL/params as JSON)
- Admin CRUD + reorder for steps scoped to a lab
- Migrate Index Playground content from in-repo `lab-summary.content` into Platform DB (seed once; thereafter admin-editable)
- Learner `GET /labs/:labSlug/summary` reads steps from DB (same response shape; no FE contract break if possible)

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Quiz Admin CRUD

Status: Todo  
Priority: P1  
Depends On:

- Admin AuthZ
- Quiz Engine
- Track & Lab Admin CRUD

Goal:  
Let admins manage per-lab quiz definitions (questions, options, correct answers, ordering) without new migrations for each lab.

Deliverables:

- Admin APIs to create/update/delete quiz, questions, and options for a lab
- Correct-answer flags writable only on admin APIs; never returned on learner definition APIs
- Reorder questions/options; validate exactly one correct option per single-select question
- Existing submit/grade/progress gating behavior unchanged

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: User Admin

Status: Todo  
Priority: P1  
Depends On:

- Admin AuthZ
- Authentication

Goal:  
Let admins list users and manage role (and light account controls) so operators can grant `admin` and support learners without direct DB access.

Deliverables:

- Admin list/search users (pagination; no password hashes or refresh tokens in responses)
- Update user role (`user` ↔ `admin`) with guardrails (cannot remove last admin — clarify in spec)
- Optional MVP: soft-disable / reactivate account if product needs it; ban/delete deferred if not required
- Audit-friendly responses (who changed what) — full Audit Log feature may come later

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Database Track Labs

Hands-on labs in the Database / SQL Track; each teaches one measurable concept (DOMAIN §Lab, ROADMAP §Phase 1). Prefer authoring lab summary, guided steps, and quizzes via **Admin / Content Ops** once those features are Done.

---

## Feature: Index Playground

Status: Done  
Priority: P1  
Depends On:

- Dataset Loader
- Experiment Runner
- Explain Runner
- Metrics Pipeline

Goal:  
Teach B-Tree index impact through before/after experiments (ROADMAP §Index Lab, PRD §Lab 1).

Deliverables:

- Run queries with and without indexes
- Create/drop index actions within sandbox
- Explain analyze and benchmark integration
- Metrics payload: scan type and row counts for FE charts
- Lab quiz definitions and summary API

Spec Folder:

- [specs/019-index-playground](../../specs/019-index-playground/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

Notes:

- Spec/plan/tasks: [specs/019-index-playground](../../specs/019-index-playground/)
- API: `GET /api/v1/labs/:labSlug/summary`; SQL/explain/quiz reuse existing modules
- Guided steps currently in-repo content; **Lab Flow Admin** migrates them to Platform DB
- Labs unit tests: 11/11 pass; full suite previously 239/239

---

## Feature: Explain Analyze Lab

Status: Todo  
Priority: P1  
Depends On:

- Explain Runner
- Metrics Pipeline
- Lab Flow Admin
- Quiz Admin CRUD

Goal:  
Teach query planner behavior via execution plans (ROADMAP §Explain Analyze Lab, PRD §Lab 2).

Deliverables:

- Normalized execution-tree payload for FE visualization
- Cost, rows, planning time, execution time in Metric Contract
- Guided scenario APIs comparing plan shapes (steps authored via Lab Flow Admin where possible)
- Quiz definitions validating planner concepts (authored via Quiz Admin CRUD where possible)

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Offset vs Cursor Lab

Status: Todo  
Priority: P1  
Depends On:

- Experiment Runner
- Benchmark Infrastructure
- Metrics Pipeline
- Lab Flow Admin
- Quiz Admin CRUD

Goal:  
Demonstrate pagination performance differences between OFFSET and cursor patterns (ROADMAP §Offset vs Cursor, PRD §Lab 3).

Deliverables:

- Side-by-side offset and cursor pagination experiments
- Benchmark comparison at scale
- Latency-vs-page-depth metrics for FE charts
- Summary content / guided steps explaining when each approach fails (content-driven via admin APIs where possible)

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Benchmark Lab

Status: Todo  
Priority: P1  
Depends On:

- Benchmark Infrastructure

Goal:  
Teach throughput and latency under load using platform benchmark tooling (ROADMAP §Benchmark, PRD §Lab 8 / §13).

Deliverables:

- Configurable RPS tiers and duration presets
- Latency P95/P99 and throughput metrics API
- Compare-runs API before/after optimization
- Educational narrative content for capacity planning

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

# Phase 2 — Track: Caching & Concurrency

Theme: Transactions, isolation, deadlocks, Redis Track, connection pooling (ROADMAP §7).

## Epic: Platform Infrastructure

Runtime infrastructure extending Phase 1 for concurrency workloads.

---

## Feature: Connection Pool Lab

Status: Todo  
Priority: P1  
Depends On:

- Experiment Runner
- Metrics Pipeline

Goal:  
Teach connection pool behavior under concurrent load (ROADMAP §Phase 2 — Connection Pool).

Deliverables:

- Pool size, wait time, and saturation metrics API
- Scenarios with constrained vs expanded pools
- Comparison metrics for FE charts
- Quiz definitions on pool sizing tradeoffs

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Worker Queue Foundation

Status: Done  
Priority: P0  
Depends On:

- Benchmark Runner

Goal:  
Establish BullMQ worker infrastructure for heavy async jobs (ENGINEERING_GUIDE §14).

Deliverables:

- Job queue, worker process, and retry primitives
- Benchmark and dataset reset routed through workers
- Dead letter handling baseline
- UseCases remain correct if Redis unavailable for cache-only paths

Spec Folder:

- [specs/012-worker-queue-foundation](../../specs/012-worker-queue-foundation/)

Checklist:

- [x] Specification created
- [x] Implemented
- [x] Tested
- [x] Documented

---

## Epic: Runtime Adapters (Redis)

Redis Track infrastructure — Playground Redis Runtime Adapter (DOMAIN §Runtime Adapter).

---

## Feature: Redis Sandbox Runtime

Status: Todo  
Priority: P0  
Depends On:

- Worker Queue Foundation
- Metrics Pipeline

Goal:  
Provide the Playground Redis Runtime Adapter for Redis Track labs (ROADMAP §Redis Track).

Deliverables:

- Isolated Redis instance per experiment session
- Cache operation execution with timeout and resource limits
- Metric Contract output: cache hit ratio, latency, key count, memory usage
- Input Surface metadata for FE Redis command / config panel
- No dependency on Playground PostgreSQL for cache operations

Spec Folder:

- _pending_ _(draft at specs/018-redis-sandbox-runtime — paused)_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Redis Track

Caching patterns and invalidation via Playground Redis Runtime Adapter (ROADMAP §Redis Track).

---

## Feature: Cache Aside

Status: Todo  
Priority: P1  
Depends On:

- Redis Sandbox Runtime

Goal:  
Demonstrate cache-aside read pattern with measurable hit/miss impact.

Deliverables:

- Read-through cache-aside experiment flow
- Cache hit ratio metrics from backend
- Before/after latency comparison
- Quiz on staleness tradeoffs

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Write Through

Status: Todo  
Priority: P1  
Depends On:

- Cache Aside

Goal:  
Show write-through consistency pattern vs cache-aside.

Deliverables:

- Write-through experiment scenarios
- Consistency and latency metrics
- Metrics payload for write path
- Comparison summary with cache-aside

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Write Behind

Status: Todo  
Priority: P2  
Depends On:

- Write Through

Goal:  
Demonstrate write-behind async persistence and its risks.

Deliverables:

- Write-behind experiment with delayed persistence
- Failure and recovery scenarios
- Metrics on write lag and data loss windows
- Educational warnings on production use

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Cache Invalidation & TTL

Status: Todo  
Priority: P1  
Depends On:

- Cache Aside

Goal:  
Teach TTL and explicit invalidation strategies (ROADMAP §Redis Track).

Deliverables:

- TTL-based expiry experiments
- Manual and event-driven invalidation demos
- Stale read detection metrics
- Quiz on invalidation strategy selection

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Cache Stampede

Status: Todo  
Priority: P2  
Depends On:

- Cache Invalidation & TTL

Goal:  
Reproduce and mitigate cache stampede under hot keys.

Deliverables:

- Stampede reproduction scenario
- Mitigation patterns (singleflight, jitter, etc.)
- Load metrics during stampede
- Summary of production mitigations

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Redis Benchmark & Metrics

Status: Todo  
Priority: P1  
Depends On:

- Benchmark Infrastructure
- Cache Aside

Goal:  
Benchmark cache-heavy workloads and expose Redis-specific metrics.

Deliverables:

- Benchmark scenarios with/without cache
- Hit ratio, latency, and memory metrics
- Charts comparable across Redis lab modules
- Integration with Benchmark Lab patterns

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Database Track — Transactions

ACID transactions and locking (ROADMAP §Database Track — Transactions, PRD §Lab 4).

---

## Feature: BEGIN / COMMIT / ROLLBACK

Status: Todo  
Priority: P1  
Depends On:

- Experiment Runner

Goal:  
Teach basic transaction boundaries and rollback behavior.

Deliverables:

- Interactive BEGIN/COMMIT/ROLLBACK scenarios
- Visible state before/after rollback
- Metrics on transaction duration
- Quiz on atomicity

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Row & Table Locks

Status: Todo  
Priority: P1  
Depends On:

- BEGIN / COMMIT / ROLLBACK

Goal:  
Demonstrate row-level and table-level lock behavior under concurrency.

Deliverables:

- Lock acquisition visualization
- Blocked vs proceeding session comparison
- Metrics on wait time
- Scenarios safe within sandbox

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Concurrency Scenarios

Status: Todo  
Priority: P1  
Depends On:

- Row & Table Locks

Goal:  
Run multi-session concurrency experiments illustrating transaction interaction.

Deliverables:

- Parallel client simulation
- Observable ordering and blocking
- Backend metrics for contention
- Summary tying behavior to application design

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Database Track — Isolation

Isolation levels and anomalies (ROADMAP §Database Track — Isolation, PRD §Lab 5).

---

## Feature: Read Uncommitted

Status: Todo  
Priority: P1  
Depends On:

- BEGIN / COMMIT / ROLLBACK

Goal:  
Demonstrate dirty reads at READ UNCOMMITTED level.

Deliverables:

- Reproducible dirty read scenario
- Metrics payload for uncommitted data visibility
- Quiz on why level is rarely used

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Read Committed

Status: Todo  
Priority: P1  
Depends On:

- Read Uncommitted

Goal:  
Show default READ COMMITTED behavior and non-repeatable reads.

Deliverables:

- Non-repeatable read demonstration
- Comparison metrics vs READ UNCOMMITTED
- Guided experiment steps

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Repeatable Read

Status: Todo  
Priority: P1  
Depends On:

- Read Committed

Goal:  
Illustrate repeatable read guarantees and remaining phantom risk.

Deliverables:

- Repeatable read experiment
- Snapshot visibility metrics
- Contrast with READ COMMITTED results

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Serializable

Status: Todo  
Priority: P1  
Depends On:

- Repeatable Read

Goal:  
Demonstrate SERIALIZABLE strictness and performance cost.

Deliverables:

- Serialization failure scenarios
- Retry guidance for learners
- Latency comparison across isolation levels

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Dirty Read & Phantom Read Demos

Status: Todo  
Priority: P1  
Depends On:

- Serializable

Goal:  
Consolidate anomaly demos with side-by-side comparisons (ROADMAP §Database Track — Isolation).

Deliverables:

- Dirty read and phantom read lab module
- Anomaly identification quiz
- Summary matrix of levels vs anomalies

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Database Track — Deadlocks

Deadlock detection and prevention (ROADMAP §Database Track — Deadlocks).

---

## Feature: Lock Ordering

Status: Todo  
Priority: P1  
Depends On:

- Row & Table Locks

Goal:  
Teach consistent lock ordering to prevent deadlocks.

Deliverables:

- Ordered vs random lock acquisition scenarios
- Deadlock occurrence metrics
- Fix demonstration via reordering

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Deadlock Detection

Status: Todo  
Priority: P1  
Depends On:

- Lock Ordering

Goal:  
Show database deadlock detection and victim selection.

Deliverables:

- Induced deadlock with detection timeline
- Backend-captured deadlock graphs or logs
- Learner-facing explanation of victim choice

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Retry Strategies

Status: Todo  
Priority: P2  
Depends On:

- Deadlock Detection

Goal:  
Demonstrate application-level retry after deadlock or serialization failure.

Deliverables:

- Retry with backoff experiment
- Success rate metrics under contention
- Best-practice summary for apps

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Deadlock Visualization

Status: Todo  
Priority: P2  
Depends On:

- Deadlock Detection

Goal:  
Visualize wait-for graphs and blocked sessions (ROADMAP §Database Track — Deadlocks).

Deliverables:

- Wait-for graph payload from backend data
- Session timeline of lock waits (API)
- Quiz definitions for deadlock concepts

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Release Milestones

| Milestone | Target              | Backlog scope (backend)                                              |
| --------- | ------------------- | -------------------------------------------------------------------- |
| MVP       | Phase 1 complete    | Database/SQL APIs: auth → run SQL → reset → EXPLAIN → benchmark → core lab backends |
| Beta      | Phase 1 + Phase 2   | Database + Caching & Concurrency (Redis, transactions, isolation) APIs |

---

## Spec Index

Link completed specs here for traceability (update **Spec Folder** in each feature when created):

| Feature                       | Spec folder                           | Status |
| ----------------------------- | ------------------------------------- | ------ |
| Track Registry                | specs/001-track-registry              | Done   |
| SQL Sandbox & Resource Limits | specs/002-sql-sandbox                 | Done   |
| Dataset Loader                | specs/003-dataset-loader              | Done   |
| Dataset Reset                 | specs/004-dataset-reset               | Done   |
| Experiment Runner             | specs/005-experiment-runner           | Done   |
| Experiment Isolation          | specs/006-experiment-isolation        | Done   |
| Explain Runner                | specs/007-explain-runner              | Done   |
| Metrics Pipeline              | specs/008-metrics-pipeline            | Done   |
| Authentication                | specs/009-authentication              | Done   |
| Per-User Rate Limit           | specs/010-per-user-rate-limit         | Done   |
| Benchmark Runner              | specs/011-benchmark-runner            | Done   |
| Worker Queue Foundation       | specs/012-worker-queue-foundation     | Done   |
| SQL Execution Queue           | specs/013-sql-execution-queue         | Done   |
| Benchmark Metrics             | specs/014-benchmark-metrics           | Done   |
| Realtime Progress             | specs/015-realtime-progress           | Done   |
| Progress Tracking             | specs/016-progress-tracking           | Done   |
| Quiz Engine                   | specs/017-quiz-engine                 | Done   |
| Index Playground              | specs/019-index-playground            | Done   |
| _add rows as specs are created_ | | |

---

## Suggested next features (P1, dependencies met)

Admin / Content Ops first so later labs are content-driven; then remaining Database Track Labs.

| Order | Feature              | Epic                 |
| ----- | -------------------- | -------------------- |
| 1     | Admin AuthZ          | Admin / Content Ops  |
| 2     | Track & Lab Admin CRUD | Admin / Content Ops |
| 3     | Lab Flow Admin       | Admin / Content Ops  |
| 4     | Quiz Admin CRUD      | Admin / Content Ops  |
| 5     | User Admin           | Admin / Content Ops  |
| 6     | Explain Analyze Lab  | Database Track Labs  |
| 7     | Offset vs Cursor Lab | Database Track Labs  |
