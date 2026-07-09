# Feature Specification: Progress Tracking

**Feature Branch**: `016-progress-tracking`

**Created**: 2026-07-09

**Status**: Done

**Input**: User description: "Track completed labs and learning path progress per Track via Platform APIs (ROADMAP §Progress, PRD §16). Deliverables: completed labs registry per user on Platform DB; learning path / sequence API within each Track; progress read APIs for FE catalog and detail surfaces; events emitted on lab completion (ENGINEERING_GUIDE §16)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-09

- Q: Who may mark a lab complete? → A: Authenticated user self-complete API now; Quiz Engine may gate later (option B).
- Q: Is the learning path public? → A: Learning path public (catalog metadata only); progress/completions auth-only (option A).
- Q: Lab slug uniqueness? → A: Globally unique lab slugs (option A).
- Q: Uncomplete / revoke completion? → A: Complete-only for MVP; no revoke API (option B).
- Q: How is the lab catalog maintained? → A: Seed/migration-only; no admin lab CRUD API (option A).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record Lab Completion (Priority: P1)

An authenticated learner finishes a lab’s required learning steps and calls the self-complete API. The platform records that lab as completed for that user on the permanent Platform database and emits a completion event so other features (e.g. Quiz Engine later) can react without tight coupling. Quiz Engine may later restrict or replace this self-complete path without changing the completion registry shape.

**Why this priority**: Without a durable completion registry, progress, learning paths, and quiz gating cannot work. This is the core write path.

**Independent Test**: Authenticate as a user; mark a known lab complete; verify the completion is stored for that user and a lab-completion / progress-updated domain event is emitted. Delivers value without FE UI.

**Acceptance Scenarios**:

1. **Given** an authenticated user and a lab that exists in the Platform lab catalog for an active Track, **When** the system records lab completion for that user, **Then** the lab appears in the user’s completed-labs registry with a completion timestamp.
2. **Given** the same user completes the same lab again, **When** completion is recorded, **Then** the registry remains idempotent (still one completion record; timestamp may update or stay first-completed — behavior is consistent and documented).
3. **Given** a successful completion write, **When** the operation finishes, **Then** a domain event is emitted identifying the user, track, and lab so other features can subscribe without calling Progress UseCases directly.
4. **Given** an unauthenticated caller, **When** they attempt to record completion, **Then** the request is rejected as unauthorized.

---

### User Story 2 - Read Progress for Catalog and Detail (Priority: P1)

FE (or API clients) need to show which labs a user has completed and overall progress within a Track. The backend exposes authenticated read APIs that return completed labs and aggregate progress for a Track without requiring playground runtime state.

**Why this priority**: Read APIs are required for FE catalog/detail surfaces; equal priority to writes for MVP learning loop visibility.

**Independent Test**: Seed completions for a user on Database / SQL labs; call progress read endpoints; verify completed lab list and Track-level progress summary match stored data.

**Acceptance Scenarios**:

1. **Given** an authenticated user with zero completions, **When** they request progress for a Track, **Then** they receive an empty completed set and a progress summary showing zero completed of the Track’s sequenced labs.
2. **Given** an authenticated user with some labs completed in a Track, **When** they request progress for that Track, **Then** the response lists those lab identifiers as completed and a summary (completed count / total sequenced labs, optional percent).
3. **Given** an authenticated user, **When** they request progress for a Track they have never touched, **Then** they receive a valid empty/zero progress payload (not an error).
4. **Given** an unauthenticated caller, **When** they request user progress, **Then** the request is rejected as unauthorized.

---

### User Story 3 - Learning Path Sequence per Track (Priority: P1)

Learners and FE need a stable ordered learning path of labs within a Track (which labs exist and in what recommended order). The backend exposes a **public** read API for the sequenced lab path (catalog metadata only—no user completion flags). Authenticated progress APIs separately overlay completion state.

**Why this priority**: BACKLOG requires a learning path / sequence API; progress percent and “next lab” depend on a defined sequence. Without a lab catalog, completion alone is not enough.

**Independent Test**: Seed Database / SQL Track with ordered labs; request learning path by Track slug without auth; verify ordered lab list (slug, title, sequence) with no completion fields. Authenticated progress read separately shows completed flags.

**Acceptance Scenarios**:

1. **Given** the Database / SQL Track has seeded labs with display/sequence order, **When** an anonymous client requests the learning path for that Track, **Then** labs are returned in stable ascending sequence order with slug and human-readable title (no per-user completion flags).
2. **Given** an authenticated user with partial completions, **When** they request Track progress (not the public path alone), **Then** the progress response indicates which path labs they have completed.
3. **Given** a Track with no labs seeded, **When** the learning path is requested, **Then** the client receives an empty list (success), not a server error.
4. **Given** a Track slug that does not exist, **When** the learning path is requested, **Then** the client receives a clear not-found response.

---

### User Story 4 - Progress Survives Playground Reset (Priority: P2)

Platform progress must not be wiped when playground experiment state is reset. Completions live only on Platform DB.

**Why this priority**: Constitution requires platform vs runtime separation; critical for trust but secondary to primary read/write APIs.

**Independent Test**: Record a completion; run a playground dataset reset; verify the completion record still exists on Platform DB.

**Acceptance Scenarios**:

1. **Given** a user has completed labs, **When** playground runtime state is reset, **Then** completed-lab records on Platform DB remain unchanged.
2. **Given** progress APIs are called after a playground reset, **When** the user reads progress, **Then** previously completed labs still appear completed.

---

### Edge Cases

- What happens when completing a lab slug that is not in the catalog? The system rejects the request with a clear not-found / invalid-lab error.
- What happens when completing a lab on a `coming-soon` Track? Completion is rejected; Track is not available for learning progress.
- What happens if the user is deleted? Progress records for that user are removed or cascade-deleted with the user (no orphan progress).
- How is “total labs” defined for percent complete? Count of labs in that Track’s learning path (catalog), not ad-hoc completion of unknown slugs.
- Concurrent completion requests for the same user+lab: result is a single completion record (idempotent).
- Anonymous / guest progress: out of scope; progress requires authentication.
- User requests to undo a completion: not supported in MVP; no revoke endpoint (complete-only).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist user lab completions on the Platform database, separate from playground runtime state.
- **FR-002**: System MUST maintain a Platform lab catalog (minimal) per Track: **globally unique** lab slug, title, Track association, and sequence/display order for the learning path.
- **FR-003**: System MUST seed an initial learning path for the Database / SQL Track via migration/seed only (no admin lab CRUD API) with MVP lab entries aligned to planned labs (e.g. index, explain, offset-cursor, benchmark) so path and progress APIs are testable before each lab feature ships.
- **FR-004**: System MUST expose an authenticated self-complete API so the current user can record completion of a catalog lab (idempotent per user+lab). Quiz Engine MAY later gate or replace this path; the completion registry shape MUST remain stable.
- **FR-005**: System MUST expose authenticated APIs to read a user’s completed labs and Track-level progress summary (completed count, total sequenced labs, and derived percent or equivalent).
- **FR-006**: System MUST expose a **public** (unauthenticated) API to read the ordered learning path for a Track (lab slug, title, sequence only—no user completion data).
- **FR-007**: System MUST emit a domain event on successful lab completion (e.g. progress/lab completed) including user id, track slug, and lab slug, without requiring other features to call Progress UseCases directly (ENGINEERING_GUIDE §16).
- **FR-008**: System MUST reject completion writes and user progress reads for unauthenticated callers; learning path catalog reads MUST remain public.
- **FR-009**: System MUST NOT store progress in Redis as the source of truth; Redis MAY be used only as optional cache that does not affect correctness if removed.
- **FR-010**: Quiz score storage and “gate completion on quiz pass” MUST remain out of scope for this feature (owned by Quiz Engine). MVP completion is user self-complete; gating is deferred.
- **FR-011**: Achievements and bookmarks are out of scope (PRD §16 lists them; Bookmarks removed from BE backlog / FE-owned or future).
- **FR-012**: System MUST NOT expose an uncomplete/revoke-completion API in this feature (complete-only MVP).
- **FR-013**: System MUST NOT expose admin create/update/delete APIs for the lab catalog in this feature; catalog changes ship via migrations/seeds only.

### Key Entities

- **Lab (catalog)**: Platform learning unit metadata — globally unique slug, title, track reference, sequence order, optional short description; not playground experiment state.
- **UserLabCompletion**: Record that a user completed a lab — user reference, lab reference (via globally unique lab slug), completed-at timestamp; unique per user+lab.
- **TrackProgressSummary**: Derived view — track slug, completed count, total labs in path, percent complete (or equivalent), list of completed lab slugs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a successful completion call, a subsequent progress read for that Track reflects the lab as completed within 1 second under normal API conditions.
- **SC-002**: 100% of completion writes for the same user+lab leave exactly one completion record (idempotent under retry/concurrency checks).
- **SC-003**: Learning path for Database / SQL returns labs in stable order across repeated requests (no shuffle).
- **SC-004**: Playground dataset reset does not reduce the user’s completed-lab count (verified in integration test).
- **SC-005**: Unauthenticated completion or user-progress-read attempts are rejected in 100% of API contract tests; unauthenticated learning-path reads succeed when the Track exists.

## Assumptions

- Backend-only: no FE pages; APIs and contracts are the deliverable for the FE team.
- Authentication (JWT) already exists and is the sole identity for progress ownership.
- Track Registry already provides Track slugs/status; Progress Tracking adds Lab catalog rows linked to Tracks. Learning path catalog reads are public (like Track list); user progress and completion require auth.
- Lab slugs are globally unique (not merely unique within a Track), so completion and lookup APIs can key by `labSlug` alone while still returning the owning Track.
- MVP lab seed entries may exist before individual lab features (Index Playground, etc.) are fully implemented; completion can still be recorded against seeded catalog labs for API/E2E readiness.
- “Lab completion” for MVP means an authenticated user self-complete API (typically called by FE), not automatic inference from experiment runs. Quiz Engine may later gate or replace this path.
- Idempotent completion keeps a single row; first `completedAt` is preserved unless product later chooses “last completed” (default: preserve first).
- Learning path is a flat ordered list per Track for MVP (no branching paths).
- MVP lab catalog is maintained like Track Registry: seed/migration only; no admin CRUD API in this feature.
- Out of scope: achievements, bookmarks, certificates, anonymous progress, admin CMS/CRUD for labs, quiz gating, uncomplete/revoke completion.
