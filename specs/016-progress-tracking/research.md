# Research: Progress Tracking

**Feature**: 016-progress-tracking | **Date**: 2026-07-09

## 1. Lab catalog ownership

**Decision**: Introduce Platform `labs` table in this feature; seed via TypeORM migration (same pattern as `InitTracksTable`).

**Rationale**: Track Registry has Tracks only. Progress percent and learning path require ordered labs. Spec clarifies seed/migration-only, no admin CRUD.

**Alternatives considered**:
- Hardcode path in code — rejects durable catalog and FE discovery
- Defer labs until each lab feature — blocks Progress Tracking APIs and Quiz Engine dependency
- Full CMS — out of scope

## 2. Completion write model

**Decision**: Authenticated self-complete UseCase; unique constraint `(user_id, lab_id)`; preserve first `completed_at` on retry (idempotent no-op).

**Rationale**: Clarification B — user self-complete for MVP; Quiz Engine may gate later without changing registry shape.

**Alternatives considered**:
- Infer completion from experiment runs — noisy, not “lab done”
- System-only complete — blocks FE until Quiz Engine
- Update `completed_at` on every retry — loses first-completion semantics preferred in assumptions

## 3. Public learning path vs auth progress

**Decision**: `GET /tracks/:trackSlug/labs` (or `/tracks/:trackSlug/learning-path`) is `@Public()`. `GET /progress/tracks/:trackSlug` and `POST .../complete` require JWT.

**Rationale**: Clarification A; mirrors public Track list. Completion flags never appear on public path response.

**Alternatives considered**:
- Auth-only path — hurts pre-login catalog
- Embed completions on public path when JWT present — mixes concerns; prefer separate progress endpoint

## 4. Globally unique lab slugs

**Decision**: `labs.slug` UNIQUE globally; complete by `labSlug` alone; responses still include `trackSlug`.

**Rationale**: Clarification A; simpler routes and events.

**Alternatives considered**: Composite uniqueness per Track — more awkward APIs and event keys

## 5. Cross-feature events

**Decision**: Emit `lab.completed` via `EventEmitter2` after successful insert (not on idempotent no-op, or emit only on first completion — prefer **emit only when a new row is created**).

**Rationale**: ENGINEERING_GUIDE §16; matches `benchmark.finished` pattern. Quiz Engine can `@OnEvent` later without calling Progress UseCases.

**Alternatives considered**:
- Emit on every idempotent call — noisy for subscribers
- Direct UseCase calls from Quiz Engine — forbidden coupling

## 6. Coming-soon Track / unknown lab

**Decision**: Reject complete if lab missing or owning Track is not `active`. Learning path for `coming-soon` Track may still return seeded labs if any (catalog metadata) OR empty — **prefer return path if labs exist, but block completion** with clear error. Unknown track slug → 404 on path and progress.

**Rationale**: Spec edge cases; discovery vs startability split already used on Tracks (`isLabStartable`).

## 7. Playground reset isolation

**Decision**: No FK or writes into playground DB; integration test asserts completions survive dataset reset.

**Rationale**: Constitution platform vs runtime separation.

## 8. Module placement

**Decision**: `src/modules/progress/` rather than stuffing into `tracks/` or `auth/`.

**Rationale**: Feature-first; Tracks stay catalog-of-tracks; Progress owns completions + lab path for learning.

**Alternatives considered**: Labs under Tracks module — couples Track Registry Done feature to new writes
