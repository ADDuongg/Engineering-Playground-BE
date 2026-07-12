# Feature Specification: Track & Lab Admin CRUD

**Feature Branch**: `021-track-lab-admin-crud`

**Created**: 2026-07-12

**Status**: Review

**Input**: User description: "Let admins create and update Track and Lab catalog metadata on Platform DB so new labs can be registered without migration-only seeds. Deliverables: Admin CRUD (or create/update/list) for Tracks (slug, name, description, status, display order, runtime/input/metric/viz config); Admin CRUD for Labs under a Track (slug, title, description, sequence order, active/coming-soon); validation for unique slugs and stable ordering; no playground DB writes; learner list/detail APIs continue to read the same Platform tables."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-12

- Q: Should learner learning-path/progress surfaces show `coming-soon` Labs, hide them, or split visibility? → A: Show `coming-soon` Labs in learner path/progress with status; block start/summary until `active`
- Q: Must Lab `sequence_order` be unique within a Track? → A: Allow duplicates; sort by (`sequence_order`, `slug`) for stable ordering
- Q: What default status applies when creating a Track or Lab if status is omitted? → A: Default omitted status to `coming-soon` (explicit `active` to publish)
- Q: When Lab status is introduced, what status do existing Lab rows receive? → A: Backfill existing Labs to `active`
- Q: How strictly should Track configuration identifiers be validated on create/update? → A: All four config fields MUST match known platform identifiers (reject unknown)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates and Updates Tracks (Priority: P1)

An authenticated platform admin registers a new learning Track (or updates an existing one) with name, description, availability status, display order, and Track configuration (runtime adapter, input surface, metric catalog, visualization kit). After save, learner-facing Track discovery reflects the change without a redeploy or migration-only seed.

**Why this priority**: Track catalog write capability is the foundation for content ops. Without it, every new domain still requires engineer-owned seed migrations.

**Independent Test**: Can be fully tested by signing in as an admin, creating a Track, listing admin Tracks, updating status/order/config, then verifying the same Track appears correctly on the public learner Track catalog.

**Acceptance Scenarios**:

1. **Given** a signed-in admin, **When** they create a Track with a unique slug and required metadata/config and omit status, **Then** the Track is persisted on Platform DB with status `coming-soon` and returned in the admin response.
2. **Given** a signed-in admin, **When** they create a Track and explicitly set status to `active`, **Then** the Track is persisted as `active` and appears as available on the learner Track catalog per existing availability rules.
3. **Given** an existing Track, **When** an admin updates name, description, status, display order, or configuration fields, **Then** subsequent learner Track list/detail responses reflect the updated values.
4. **Given** a non-admin authenticated user, **When** they attempt to create or update a Track via admin operations, **Then** the request is forbidden and no catalog change occurs.
5. **Given** an unauthenticated caller, **When** they attempt admin Track create/update, **Then** the request is rejected as unauthorized.

---

### User Story 2 - Admin Creates and Updates Labs Under a Track (Priority: P1)

An admin adds a Lab under an existing Track (or updates an existing Lab) with slug, title, description, sequence order, and availability status (`active` or `coming-soon`). Learners browsing that Track’s lab path see the new or updated Lab without code changes for catalog metadata.

**Why this priority**: Lab registration is the primary operator workflow that unblocks content-driven Database Track labs (Explain, Offset, etc.) after Admin AuthZ.

**Independent Test**: Can be tested by creating a Lab under an existing Track as admin, verifying admin list/detail for that Track’s labs, updating sequence order and status, and confirming progress/learning path consumers that read Platform Labs see the change.

**Acceptance Scenarios**:

1. **Given** an existing Track and a signed-in admin, **When** they create a Lab with a unique slug under that Track and omit status, **Then** the Lab is stored on Platform DB with status `coming-soon` and associated with that Track.
2. **Given** an existing Track and a signed-in admin, **When** they create a Lab and explicitly set status to `active`, **Then** the Lab is stored as `active` and learner path/progress may treat it as startable.
3. **Given** an existing Lab, **When** an admin updates title, description, sequence order, or status, **Then** learner-facing lab catalog/progress consumers reading Platform Lab records observe the updated metadata.
4. **Given** a Track does not exist, **When** an admin attempts to create a Lab under that Track, **Then** the request fails with a clear not-found (or validation) error and no Lab is created.
5. **Given** a non-admin caller, **When** they attempt Lab create/update via admin operations, **Then** access is denied with no side effects.

---

### User Story 3 - Admin Lists and Inspects Catalog Metadata (Priority: P1)

An admin lists Tracks and Labs (including coming-soon items) and retrieves a single Track or Lab by identifier so they can verify catalog state before and after edits. Admin list views are operator-oriented and may include fields useful for content ops while remaining free of playground runtime data.

**Why this priority**: Create/update without reliable list/read makes content ops unverifiable and blocks safe iterative authoring.

**Independent Test**: Can be tested by seeding or creating several Tracks/Labs, calling admin list and get endpoints as admin, and verifying ordering, status, and config fields are present and accurate.

**Acceptance Scenarios**:

1. **Given** multiple Tracks exist, **When** an admin lists Tracks, **Then** results are returned in a stable order (display order, then name) including both `active` and `coming-soon` Tracks.
2. **Given** multiple Labs exist under a Track (including some with the same sequence order), **When** an admin lists Labs for that Track, **Then** Labs are returned ordered by sequence order then slug, with status and identifying metadata.
3. **Given** a valid Track or Lab identifier, **When** an admin requests detail, **Then** they receive full catalog metadata needed to edit (without playground experiment state).
4. **Given** an unknown Track or Lab identifier, **When** an admin requests detail, **Then** they receive a clear not-found response.

---

### User Story 4 - Learner Catalog Continues Reading Shared Platform Tables (Priority: P1)

Learners continue to discover Tracks (and Labs via existing progress/learning-path surfaces) from the same Platform catalog that admins edit. Admin writes never touch playground runtime databases, and playground reset never alters Track/Lab catalog rows.

**Why this priority**: Platform vs runtime separation is a constitution principle; breaking learner read paths or mixing playground state would regress MVP learning flows.

**Independent Test**: Can be tested by updating a Track/Lab as admin, confirming learner public/authenticated catalog reads show the change, running a playground reset, and confirming catalog rows remain unchanged.

**Acceptance Scenarios**:

1. **Given** an admin sets a Track to `coming-soon`, **When** a learner requests the public Track catalog, **Then** that Track appears with `coming-soon` status (discovery still works; lab-start rules for coming-soon remain as today).
2. **Given** an admin creates a new Lab on Platform DB, **When** progress/learning-path APIs that read Labs are exercised, **Then** they resolve the new Lab from Platform tables without requiring a new seed migration for that Lab’s metadata.
3. **Given** a Lab is `coming-soon`, **When** a learner requests learning path or track progress for its Track, **Then** the Lab appears in the ordered list with `coming-soon` status visible, and lab start/summary for that Lab is blocked until status is `active`.
4. **Given** playground runtime data is reset, **When** Track and Lab catalog records are inspected afterward, **Then** they remain intact.

---

### User Story 5 - Admin Soft-Hides Catalog Items via Status (Priority: P2)

Instead of hard-deleting catalog rows that may be referenced by progress or quizzes, an admin marks a Track or Lab as `coming-soon` (unavailable for normal learning entry) to hide it from active learning flows while preserving historical references.

**Why this priority**: Protects referential integrity for completions and quizzes; hard delete can wait until clearer product rules exist. Soft-hide via status delivers the operator need to stop offering a lab/track.

**Independent Test**: Can be tested by flipping a Lab/Track to `coming-soon` as admin and verifying learner start/summary behavior treats it as unavailable while the row still exists for admin list/detail.

**Acceptance Scenarios**:

1. **Given** an active Lab with existing learner completions, **When** an admin sets its status to `coming-soon`, **Then** the Lab row remains, completions are not deleted, the Lab still appears on learner path/progress with `coming-soon` status, and learner entry/summary is blocked until it is `active` again.
2. **Given** an admin soft-hides a Track via `coming-soon`, **When** learners attempt lab entry under that Track, **Then** entry remains blocked consistent with existing Track availability rules.
3. **Given** MVP scope, **When** an admin attempts permanent hard delete of a Track or Lab, **Then** hard delete is not offered (or is rejected) so referential integrity is preserved.

---

### Edge Cases

- What happens when creating a Track or Lab with a duplicate slug? Reject with a clear validation/conflict error; no partial write.
- What happens when updating a Lab’s Track association to a different Track? Reject or disallow in MVP to keep progress/path integrity simple; Labs stay under their original Track after create.
- What happens when two Labs under the same Track share the same `sequence_order`? Allowed. Admin and learner lists MUST remain deterministic by sorting (`sequence_order` ascending, then `slug` ascending). No auto-renumber on conflict.
- What happens when a learner opens summary/start for a `coming-soon` Lab that still appears on the learning path? Request is rejected with a clear unavailable/coming-soon message; path listing itself still includes the Lab.
- What happens when required Track config fields are missing or use unknown identifier values? Reject with structured validation errors naming the invalid fields. Runtime adapter, input surface, metric catalog, and visualization kit MUST each be from the platform’s known identifier sets.
- What happens when slug format is invalid (empty, whitespace, unsafe characters)? Reject with validation error; slugs remain URL-safe identifiers.
- What happens if an admin changes a Track’s runtime adapter after Labs exist? Allow update of declarative config (operators own correctness); this feature does not migrate lab content or runtime data.
- What happens when a non-admin calls learner Track GET endpoints? Unchanged — public/learner reads remain available; no admin write capability on those routes.
- How are empty catalogs handled? Admin list returns an empty collection successfully; create remains available.
- What status do newly created Tracks/Labs get when the client omits status? `coming-soon` (admin must set `active` to publish).
- What status do Labs that already exist before Lab status ships receive? All backfilled to `active` (no accidental unpublish of Index Playground and other seeded labs).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated admins to create Tracks on Platform DB with: unique slug, name, description, status (`active` | `coming-soon`), display order, runtime adapter type, input surface type, metric catalog reference, and visualization kit reference. When status is omitted on create, System MUST default it to `coming-soon`.
- **FR-002**: System MUST allow authenticated admins to update mutable Track fields (name, description, status, display order, and configuration references). Slug MUST be immutable after create.
- **FR-003**: System MUST allow authenticated admins to list Tracks and retrieve a single Track by slug (or stable id), including coming-soon Tracks, in stable display order.
- **FR-004**: System MUST allow authenticated admins to create Labs under an existing Track with: unique slug, title, optional description, sequence order, and status (`active` | `coming-soon`). When status is omitted on create, System MUST default it to `coming-soon`.
- **FR-005**: System MUST allow authenticated admins to update mutable Lab fields (title, description, sequence order, status). Slug MUST be immutable after create. Track association MUST NOT change after create in this feature.
- **FR-006**: System MUST allow authenticated admins to list Labs for a Track and retrieve a single Lab by slug (or stable id), ordered by `sequence_order` ascending then `slug` ascending (duplicate `sequence_order` values are allowed).
- **FR-007**: System MUST reject create/update attempts with duplicate Track or Lab slugs using a clear conflict/validation response.
- **FR-008**: System MUST reject admin catalog mutations from non-admin authenticated users (forbidden) and from unauthenticated callers (unauthorized), reusing Admin AuthZ enforcement.
- **FR-009**: System MUST persist all Track and Lab catalog writes exclusively on Platform DB and MUST NOT write to playground runtime databases as part of this feature.
- **FR-010**: Learner-facing Track list/detail APIs MUST continue to read the same Platform Track table that admins mutate (no separate shadow catalog).
- **FR-011**: Progress and other learner surfaces that already read Platform Lab rows MUST continue to use those same rows after admin Lab create/update (no duplicate Lab store).
- **FR-012**: Labs MUST support availability status (`active` | `coming-soon`) comparable to Tracks so operators can soft-hide Labs without hard delete.
- **FR-013**: System MUST NOT provide hard delete of Tracks or Labs in this feature; operators soft-hide via status instead.
- **FR-014**: Admin catalog operations MUST return structured, validated response payloads consistent with the platform’s standard success/error envelope (not internal storage records).
- **FR-015**: Admin Track/Lab write and list capabilities MUST live under the admin operator surface and MUST NOT add admin mutation capabilities onto learner Track/Lab discovery routes.
- **FR-016**: System MUST validate required fields and enum/config values on create/update and return actionable field-level errors when invalid. Track configuration fields — runtime adapter type, input surface type, metric catalog reference, and visualization kit reference — MUST each match a known platform identifier set; unknown values MUST be rejected.
- **FR-017**: Existing seeded Tracks and Labs MUST remain readable/updatable through the same admin APIs (no migration-only-only path after this feature).
- **FR-018**: Learner learning-path and track-progress surfaces MUST include `coming-soon` Labs with status visible (same inclusion model as Track catalog). Lab start and lab summary MUST be blocked for Labs that are not `active`.
- **FR-019**: Lab `sequence_order` NEED NOT be unique within a Track. Create/update MUST accept duplicate orders; all Lab list surfaces (admin and learner) MUST sort by (`sequence_order` ASC, `slug` ASC).
- **FR-020**: When Lab availability status is introduced, System MUST backfill all pre-existing Lab rows to `active` so currently offered labs remain startable without manual republish.

### Key Entities

- **Track**: Learning domain catalog record on Platform DB. Attributes: slug (immutable unique id), name, description, status, display order, runtime adapter type, input surface type, metric catalog reference, visualization kit reference.
- **Lab**: Smallest learning-unit catalog record on Platform DB, belonging to exactly one Track. Attributes: slug (immutable unique id), title, description, sequence order (not unique per Track; ties broken by slug), status (`active` | `coming-soon`), track association.
- **Admin operator**: Authenticated user with admin role who may mutate catalog metadata; not a separate identity system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can register a new Track and see it on the learner Track catalog without a deploy that only ships seed SQL for that Track.
- **SC-002**: An admin can register a new Lab under an existing Track and have Platform Lab readers (progress/learning path) observe it without a new Lab seed migration for metadata.
- **SC-003**: 100% of admin Track/Lab create and update attempts by non-admin users are denied with no catalog mutation.
- **SC-004**: After playground reset, 100% of Track and Lab catalog rows previously written by admins remain unchanged.
- **SC-005**: Duplicate slug create attempts fail in a clear, predictable way (operator can correct and retry successfully on next attempt).
- **SC-006**: Soft-hiding a Lab or Track via `coming-soon` preserves existing learner completion history for that Lab (no cascade delete of progress).
- **SC-007**: After a Lab is set to `coming-soon`, learners still see it on learning path/progress with that status, and 100% of start/summary attempts for that Lab are denied until it is `active` again.
- **SC-008**: After Lab status is introduced, all Labs that existed before the change remain `active` and continue to be startable without an admin republish step.

## Assumptions

- Admin AuthZ (`Role.ADMIN`, admin namespace, reusable roles guard) is already Done and is reused without redesign.
- Track Registry and Progress Tracking Platform tables/entities already exist; this feature adds admin write/list surfaces and Lab status if missing, rather than inventing a parallel catalog.
- Category entity/admin CRUD is out of scope; Labs attach directly to Tracks as they do today.
- Guided lab steps (Lab Flow Admin) and quiz definition admin (Quiz Admin CRUD) are out of scope; this feature covers Track/Lab catalog metadata only.
- Hard delete, slug rename, and moving a Lab between Tracks are out of scope for MVP of this feature.
- Metric catalog and visualization kit values remain declarative references validated against known platform identifier sets (not free-form strings and not full kit editors). New kits/adapters become creatable only after the known set is extended.
- FE admin UI is out of scope; backend exposes contracts for a separate FE team.
- Public learner Track discovery behavior (including unauthenticated list) remains as specified by Track Registry unless an admin status change intentionally alters availability.
- Create-time status default (`coming-soon` when omitted) applies to admin-created rows only. Pre-existing Labs are backfilled to `active` when Lab status is introduced.
