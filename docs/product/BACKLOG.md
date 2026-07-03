# BACKLOG

Version: 1.3

Status: Active

Sources: [PRD.md](./PRD.md) · [ROADMAP.md](./ROADMAP.md) · [DOMAIN.md](../engineering/DOMAIN.md) · [SYSTEM_DESIGN.md](../engineering/SYSTEM_DESIGN.md) · [ARCHITECTURE.md](../engineering/ARCHITECTURE.md) · [ENGINEERING_GUIDE.md](../engineering/ENGINEERING_GUIDE.md)

---

## Domain hierarchy

Content is organized as **Track → Category → Lab → Experiment**.

| Level | Role |
| ----- | ---- |
| **Track** | Learning domain — **Phase 1:** Database/SQL · **Phase 2:** Caching & Concurrency · **Phase 4:** Frontend Performance |
| **Category** | Group within a Track (indexes, cache patterns, memoization, …) |
| **Lab** | Smallest learning unit; teaches one concept |
| **Experiment** | Input → Runtime Adapter → Metric Contract → Visualization |

Each Track declares a **Runtime Adapter**, **Input Surface**, **Metric Catalog**, and **Visualization Kit**. The Lab Shell layout is shared; panel content is Track-specific.

Active backlog covers **Phase 1, 2, and 4** only. MVP ships **Phase 1 — Database / SQL** first.

---

## How to use with Spec Kit

1. Scan **Phase → Epic → Feature** below; pick the highest-priority feature whose dependencies are **Done**.
2. Run `/speckit-specify` using the **Feature Name** and **Goal** as scope → creates `specs/[###-feature-name]/`.
3. Update **Spec Folder** and set **Status** to `Spec Ready` → `Implementing` → `Review` → `Done`.
4. Continue workflow: `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
5. Complete the feature **Checklist** and verify [Definition of Done](../../.specify/memory/constitution.md).

**Phase completion**: all features **Done** for the Phase's Track(s) + labs documented + Runtime Adapter verified + tests passing + performance verified (ROADMAP §14).

**MVP target** (ROADMAP §4–5): **Phase 1 — Database / SQL** — P0/P1 through Benchmark Lab + Learning Platform + Index / EXPLAIN / Offset labs.

**In-scope phases**: 1 (Database), 2 (Caching), 4 (Frontend). Phases 3, 5, 6 and Future epics are out of scope for this backlog.

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

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Dataset Reset

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Experiment Runner

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Explain Runner

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Metrics Pipeline

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: SQL Sandbox & Resource Limits

Status: Todo  
Priority: P0  
Depends On:

- None

Goal:  
Enforce sandbox boundaries so only allowed SQL runs with bounded cost (PRD §19–20, ENGINEERING_GUIDE §12).

Deliverables:

- Parameterized queries only; block dangerous statements
- Per-query timeout and resource caps
- Rate limiting for expensive operations
- Structured sandbox violation errors for learners

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Experiment Isolation

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Benchmark Infrastructure

Async load-test execution separate from HTTP request path (SYSTEM_DESIGN §Benchmark Runner, ENGINEERING_GUIDE §13–14).

---

## Feature: Benchmark Runner

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Benchmark Metrics

Status: Todo  
Priority: P1  
Depends On:

- Benchmark Runner

Goal:  
Collect and expose throughput, latency, and error metrics from completed benchmarks (PRD §13, ROADMAP §Benchmark).

Deliverables:

- Latency, P95, P99, RPS, throughput, error rate aggregates
- Store benchmark results for history and comparison
- Backend-owned metrics API for charts
- Consistent metric units across all benchmark labs

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Realtime Progress

Status: Todo  
Priority: P2  
Depends On:

- Benchmark Runner

Goal:  
Stream benchmark progress to the UI while long-running load tests execute.

Deliverables:

- Live progress indicator (phase, elapsed time, current RPS)
- Partial metrics preview during run
- Graceful handling of disconnect and completion states
- No polling overload on API

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

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

User-facing discovery, auth, progress, and lab experience across Tracks (PRD §7, §10, ROADMAP §Platform Foundation / Learning System).

---

## Feature: Track Registry

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Authentication

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

_Note: Backend auth module partially exists in `apps/api` — complete checklist when full scope (including web) is done._

---

## Feature: Landing Page

Status: Todo  
Priority: P1  
Depends On:

- Authentication

Goal:  
Introduce the platform value proposition and route users into Tracks and labs (ROADMAP §Platform Foundation).

Deliverables:

- Hero, learning philosophy, and MVP Track highlights (Database / SQL)
- Clear CTA to browse Tracks or sign in
- Responsive layout with accessibility baseline (PRD §21)
- No installation messaging — experiments run in browser

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Track Browser

Status: Todo  
Priority: P1  
Depends On:

- Authentication
- Track Registry
- Landing Page

Goal:  
Let users discover learning domains (Tracks) before drilling into labs (ROADMAP §Track Browser).

Deliverables:

- List available Tracks with name, description, lab count, and status
- Coming-soon state for Phase 2 (Caching) and Phase 4 (Frontend) Tracks
- Navigation to Lab Browser filtered by selected Track
- Empty and loading states

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Lab Browser

Status: Todo  
Priority: P1  
Depends On:

- Authentication
- Track Registry
- Track Browser
- Landing Page

Goal:  
Let users discover and open labs from a catalog within a Track (ROADMAP §Lab Browser).

Deliverables:

- List labs for selected Track with title, difficulty, category, and learning goal summary
- Filter entry points for category and difficulty (basic)
- Empty and loading states
- Navigation to Lab Detail Page

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Lab Detail Page

Status: Todo  
Priority: P1  
Depends On:

- Lab Browser

Goal:  
Present lab overview, learning objective, and entry into the lab shell before experimentation (PRD §7 user journey).

Deliverables:

- Lab description, learning goal, and prerequisites
- Estimated duration and difficulty badge
- Start lab / resume progress actions
- Link from browser without entering shell prematurely

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Lab Search, Categories & Difficulty

Status: Todo  
Priority: P2  
Depends On:

- Lab Browser

Goal:  
Improve lab discovery via search, categories, and difficulty levels within a Track (ROADMAP §Platform Foundation, PRD §15).

Deliverables:

- Full-text or faceted search across lab catalog (scoped to Track)
- Category taxonomy per Track (e.g. Database: indexes, plans, pagination)
- Difficulty labels: Beginner → Expert
- Search results integrated with Lab Browser

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Bookmarks

Status: Todo  
Priority: P2  
Depends On:

- Authentication
- Lab Browser

Goal:  
Allow users to save labs for later (ROADMAP §Bookmarks, PRD §16).

Deliverables:

- Bookmark add/remove per lab
- Bookmarks list on profile or browser
- Persist bookmarks on Platform DB
- Sync bookmarks across sessions

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Progress Tracking

Status: Todo  
Priority: P1  
Depends On:

- Authentication
- Lab Browser

Goal:  
Track completed labs and learning path progress per Track (ROADMAP §Progress, PRD §16).

Deliverables:

- Completed labs registry per user
- Learning path / sequence visibility within each Track
- Progress surfaced on Track Browser, Lab Browser, and Detail Page
- Events emitted on lab completion (ENGINEERING_GUIDE §16)

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Quiz Engine

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Lab Shell

Status: Todo  
Priority: P1  
Depends On:

- Lab Detail Page
- Experiment Runner
- Metrics Pipeline

Goal:  
Provide the standard four-panel Lab Shell with Track-specific panel content (PRD §10, ROADMAP §Learning System).

Deliverables:

- Left panel: theory content
- Middle panel: **Input Surface** (pluggable per Track)
  - Database Track → SQL editor with run actions
  - Future Tracks → component sandbox, config form, diagram builder, etc.
- Right panel: visualization from backend metrics (Track Visualization Kit)
- Bottom panel: metrics display (Track Metric Catalog)
- Consistent shell reused by all labs; only panel plugins change per Track

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Database Track Labs

Hands-on labs in the Database / SQL Track; each teaches one measurable concept (DOMAIN §Lab, ROADMAP §Phase 1).

---

## Feature: Index Playground

Status: Todo  
Priority: P1  
Depends On:

- Dataset Loader
- Experiment Runner
- Explain Runner
- Metrics Pipeline
- Lab Shell

Goal:  
Teach B-Tree index impact through before/after experiments (ROADMAP §Index Lab, PRD §Lab 1).

Deliverables:

- Run queries with and without indexes
- Create/drop index actions within sandbox
- Explain analyze and benchmark integration
- Visualization of scan type and row counts
- Lab quiz and summary

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Explain Analyze Lab

Status: Todo  
Priority: P1  
Depends On:

- Explain Runner
- Metrics Pipeline
- Lab Shell

Goal:  
Teach query planner behavior via execution plans (ROADMAP §Explain Analyze Lab, PRD §Lab 2).

Deliverables:

- Interactive execution tree visualization
- Cost, rows, planning time, execution time display
- Guided scenarios comparing plan shapes
- Quiz validating planner concepts

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
- Lab Shell

Goal:  
Demonstrate pagination performance differences between OFFSET and cursor patterns (ROADMAP §Offset vs Cursor, PRD §Lab 3).

Deliverables:

- Side-by-side offset and cursor pagination experiments
- Benchmark comparison at scale
- Visualization of latency vs page depth
- Summary explaining when each approach fails

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
- Lab Shell

Goal:  
Teach throughput and latency under load using platform benchmark tooling (ROADMAP §Benchmark, PRD §Lab 8 / §13).

Deliverables:

- Configurable RPS tiers and duration presets
- Latency P95/P99 and throughput charts
- Compare runs before/after optimization
- Educational narrative tying metrics to capacity planning

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
- Lab Shell

Goal:  
Teach connection pool behavior under concurrent load (ROADMAP §Phase 2 — Connection Pool).

Deliverables:

- Visualize pool size, wait time, and saturation
- Scenarios with constrained vs expanded pools
- Metrics-driven comparison charts
- Quiz on pool sizing tradeoffs

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Worker Queue Foundation

Status: Todo  
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

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

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
- Input Surface: command / config panel plugin for Lab Shell middle panel
- No dependency on Playground PostgreSQL for cache operations

Spec Folder:

- _pending_

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
- Lab Shell

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
- Visualization of write path
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
- Lab Shell

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
- Visualization of uncommitted data visibility
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

- Wait-for graph UI from backend data
- Session timeline of lock waits
- Integrated quiz

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

# Phase 4 — Track: Frontend Performance

Theme: React Rendering, browser rendering, bundle and network optimization (ROADMAP §9, PRD §17).

## Epic: Runtime Adapters (Headless React)

React Rendering Track infrastructure — component sandbox and render profiling (DOMAIN §Runtime Adapter).

---

## Feature: React Sandbox Runtime

Status: Todo  
Priority: P0  
Depends On:

- Lab Shell
- Metrics Pipeline

Goal:  
Provide the Headless React Runtime Adapter for React Rendering Track labs (ROADMAP §React Rendering Track).

Deliverables:

- Isolated component render environment per experiment session
- Render count and commit duration capture from backend
- Metric Contract output for React-specific metrics (render count, commit duration, memo hit rate)
- Input Surface: component sandbox plugin for Lab Shell middle panel
- No dependency on Playground PostgreSQL

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: React Rendering Track

---

## Feature: Render Count & Profiler

Status: Todo  
Priority: P1  
Depends On:

- React Sandbox Runtime
- Lab Shell

Goal:  
Make React re-render behavior visible (ROADMAP §React Rendering Track).

Deliverables:

- Render count instrumentation in lab UI
- React Profiler integration
- Before/after comparison exercises

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: React.memo, useMemo, useCallback

Status: Todo  
Priority: P1  
Depends On:

- Render Count & Profiler

Goal:  
Teach memoization tools and when they help or hurt.

Deliverables:

- Interactive memo toggles with metrics
- Misuse scenarios (unnecessary memo)
- Quiz on optimization criteria

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: List Virtualization

Status: Todo  
Priority: P2  
Depends On:

- Render Count & Profiler

Goal:  
Demonstrate virtualization for large lists (ROADMAP §React Rendering Track).

Deliverables:

- Virtualized vs full list performance comparison
- Scroll and paint metrics from backend/browser capture
- Summary on list sizing thresholds

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Browser Rendering Track

---

## Feature: Layout, Paint & Composite

Status: Todo  
Priority: P1  
Depends On:

- Lab Shell

Goal:  
Explain browser rendering pipeline stages (ROADMAP §Browser Rendering Track).

Deliverables:

- Stage-by-stage rendering demos
- Timeline visualization
- Quiz on pipeline order

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Reflow & Repaint

Status: Todo  
Priority: P1  
Depends On:

- Layout, Paint & Composite

Goal:  
Show cost of layout thrashing and repaints.

Deliverables:

- Reflow-inducing vs compositor-only changes
- Paint count metrics
- Optimization checklist for learners

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: GPU & Layer Optimization

Status: Todo  
Priority: P2  
Depends On:

- Reflow & Repaint

Goal:  
Teach layer promotion and GPU compositing (ROADMAP §Browser Rendering — GPU).

Deliverables:

- Layer explosion vs disciplined promotion demos
- Frame time metrics
- Summary on will-change and transforms

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Bundle Track

---

## Feature: Lazy Loading & Dynamic Import

Status: Todo  
Priority: P1  
Depends On:

- Lab Shell

Goal:  
Reduce initial bundle via lazy routes and components (ROADMAP §Bundle Track).

Deliverables:

- Before/after bundle size comparison
- Route-level lazy load exercise
- Load time metrics

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Tree Shaking & Code Splitting

Status: Todo  
Priority: P1  
Depends On:

- Lazy Loading & Dynamic Import

Goal:  
Demonstrate dead code elimination and chunk splitting.

Deliverables:

- Tree-shaking visibility in build output
- Manual vs automatic split comparison
- Quiz on import patterns

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Route Splitting

Status: Todo  
Priority: P2  
Depends On:

- Tree Shaking & Code Splitting

Goal:  
Apply route-based code splitting for multi-lab SPA (ROADMAP §Bundle Track).

Deliverables:

- Per-route chunk map
- Navigation load metrics
- Best practices summary

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Epic: Network Optimization Track

---

## Feature: Request Waterfall & Payload Size

Status: Todo  
Priority: P1  
Depends On:

- Lab Shell

Goal:  
Visualize network waterfalls and payload impact (ROADMAP §Network Optimization).

Deliverables:

- Waterfall chart from captured HAR-like metrics
- Payload size before/after compression demo
- Quiz on request chaining

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Caching Headers & CDN Concepts

Status: Todo  
Priority: P2  
Depends On:

- Request Waterfall & Payload Size

Goal:  
Teach HTTP caching and CDN edge behavior.

Deliverables:

- Cache-Control experiment scenarios
- CDN hit/miss simulation
- Metrics on TTFB improvement

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Feature: Network Performance Metrics

Status: Todo  
Priority: P2  
Depends On:

- Request Waterfall & Payload Size

Goal:  
Consolidate network KPIs for frontend performance labs.

Deliverables:

- TTFB, download time, and resource count dashboards
- Compare optimized vs baseline runs
- Summary tying metrics to user-perceived speed

Spec Folder:

- _pending_

Checklist:

- [ ] Specification created
- [ ] Implemented
- [ ] Tested
- [ ] Documented

---

## Release Milestones

| Milestone | Target              | Backlog scope                                                        |
| --------- | ------------------- | -------------------------------------------------------------------- |
| MVP       | Phase 1 complete    | Database/SQL: login → run SQL → reset → EXPLAIN → benchmark → core labs |
| Beta      | Phase 1 + Phase 2   | Database + Caching & Concurrency (Redis, transactions, isolation)    |
| Public    | Phase 1 + 2 + 4     | All three Tracks: Database, Caching, Frontend Performance            |

---

## Spec Index

Link completed specs here for traceability (update **Spec Folder** in each feature when created):

| Feature            | Spec folder | Status                                       |
| ------------------ | ----------- | -------------------------------------------- |
| Authentication     | _pending_   | Backend API partial (`apps/api` auth module) |
| Track Registry     | _pending_   | Todo                                         |
| _add rows as specs are created_ | | |

---

## Suggested next features (P0, dependencies met)

| Order | Feature                       | Epic                              |
| ----- | ----------------------------- | --------------------------------- |
| 1     | Track Registry                | Learning Platform                 |
| 2     | SQL Sandbox & Resource Limits | Runtime Adapters (PostgreSQL)     |
| 3     | Dataset Loader                | Runtime Adapters (PostgreSQL)     |
| 4     | Authentication                | Learning Platform                 |
| 5     | Dataset Reset                 | Runtime Adapters (PostgreSQL)     |
| 6     | Experiment Isolation          | Runtime Adapters (PostgreSQL)     |
| 7     | Experiment Runner             | Runtime Adapters (PostgreSQL)     |
