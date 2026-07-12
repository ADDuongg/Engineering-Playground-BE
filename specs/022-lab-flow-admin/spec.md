# Feature Specification: Lab Flow Admin

**Feature Branch**: `022-lab-flow-admin`

**Created**: 2026-07-12

**Status**: Review

**Input**: User description: "Persist and manage ordered guided steps per lab (e.g. Index Playground: run SQL → explain → create index → re-run → quiz) so lab summary is content-driven instead of hardcoded TypeScript. Deliverables: Platform DB model for lab guided steps (order, title, instruction, action type, optional payload for recommended SQL/DDL/params as JSON); Admin CRUD + reorder for steps scoped to a lab; Migrate Index Playground content from in-repo lab-summary.content into Platform DB (seed once; thereafter admin-editable); Learner GET /labs/:labSlug/summary reads steps from DB (same response shape; no FE contract break if possible)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-12

- Q: After seed, should learner summary fall back to in-repo hardcoded content if Platform content is missing? → A: Hard cutover — Index Playground (and learner summary generally) reads Platform DB only; in-repo content is unused after cutover
- Q: Where should recommended SQL/DDL fields live after migration? → A: Named curriculum fields on the Lab (same as today’s summary response); step `payload` is optional extras only
- Q: How should Index Playground content seed behave on re-run? → A: Skip seed when curriculum or any steps already exist for Index Playground
- Q: How should admin curriculum updates work? → A: Partial update — omit fields unchanged; only sent fields are updated
- Q: How can admins clear nullable curriculum fields on partial update? → A: Explicit `null` clears nullable fields; omit leaves them unchanged

### Session 2026-07-12 (enhancement — step SQL payloads)

- Q: Should recommended SQL/DDL live only on curriculum top-level, or per guided step for admin CRUD? → A: Primary source is each guided step’s `payload` (per action). Learner `guidedSteps[]` MUST include `payload`. Top-level `recommendedQuery` / create / drop index fields remain on the summary response for FE compatibility and are **derived** from the first matching step payload (fallback to curriculum columns if step payload missing).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Manages Guided Steps for a Lab (Priority: P1)

An authenticated platform admin creates, updates, lists, reorders, and deletes ordered guided steps for an existing Lab. Each step has a title, instruction, action type (what the learner is expected to do next), display order, and optional structured payload that holds the **recommended SQL/DDL for that step** (so operators edit Apply-query content on the step itself). After save, operators can verify the step list without redeploying code.

**Why this priority**: Content-driven lab flows are the primary goal of this feature. Without admin write/reorder for steps, Index Playground and later labs remain hardcoded.

**Independent Test**: Can be fully tested by signing in as admin, creating several steps under an existing Lab, reordering them, updating one instruction, deleting one step, and verifying admin list reflects the final ordered set.

**Acceptance Scenarios**:

1. **Given** an existing Lab and a signed-in admin, **When** they create a guided step with title, instruction, action type, and order, **Then** the step is persisted on Platform DB scoped to that Lab and returned in the admin response.
2. **Given** existing steps for a Lab, **When** an admin updates a step’s title, instruction, action type, order, or optional payload, **Then** subsequent admin list/detail for that Lab’s steps reflect the change.
3. **Given** multiple steps for a Lab, **When** an admin submits a reorder (explicit ordered list of step identities), **Then** the steps are returned in the new order on admin list and on the learner lab summary.
4. **Given** an existing step, **When** an admin deletes it, **Then** it no longer appears in admin list or learner summary for that Lab.
5. **Given** a Lab does not exist, **When** an admin attempts to create or list steps for it, **Then** the request fails with a clear not-found response and no step is created.
6. **Given** a non-admin authenticated user, **When** they attempt any step admin operation, **Then** the request is forbidden and no content change occurs.

---

### User Story 2 - Admin Manages Lab Summary Curriculum Fields (Priority: P1)

An admin creates lab-level summary curriculum as named fields, then partially updates them over time: learning goal, theory, dataset hint, quiz-required flag, optional benchmark note, and optional curriculum-level SQL fields (kept for compatibility / fallback). **Per-step recommended SQL for Apply actions lives primarily on guided-step payloads**, not only on curriculum. Together with guided steps, this makes the full learner summary content-editable.

**Why this priority**: Migrating only steps would leave learning goal, theory, and recommended SQL hardcoded, blocking the “remove in-repo content” deliverable and risking a split source of truth.

**Independent Test**: Can be tested by updating Index Playground (or a test Lab) summary fields as admin, then calling learner summary and verifying learning goal, theory, recommended query, and related fields match without reading TypeScript content files.

**Acceptance Scenarios**:

1. **Given** an existing Lab and a signed-in admin, **When** they create summary curriculum with required fields for that Lab, **Then** the values are persisted on Platform DB and returned on admin get.
2. **Given** summary curriculum exists for a Lab, **When** an admin partially updates theory or recommended query (other fields omitted), **Then** only the sent fields change and the learner lab summary reflects those updates while omitted fields remain unchanged.
3. **Given** summary curriculum exists with optional nullable fields set, **When** an admin sends an explicit `null` for such a field, **Then** that field is cleared; omitted nullable fields remain unchanged.
4. **Given** a Lab has no summary curriculum yet, **When** a learner requests lab summary, **Then** the system returns a clear not-found (or equivalent) rather than falling back to hardcoded TypeScript content after migration.
5. **Given** a non-admin caller, **When** they attempt to write summary curriculum, **Then** access is denied.

---

### User Story 3 - Learner Lab Summary Reads Platform Content (Priority: P1)

A learner (or authenticated client) calling the existing lab summary endpoint receives guided steps and curriculum fields loaded from Platform DB. The response shape remains compatible with the current lab summary contract so the frontend does not require a breaking change.

**Why this priority**: The learning experience must keep working after content moves off hardcoded files; contract stability is an explicit deliverable.

**Independent Test**: Can be tested by seeding Platform content for `index-playground`, calling `GET /labs/index-playground/summary` as a learner, and asserting guided step order/titles/actions and curriculum fields match seeded data with the same response field names as before.

**Acceptance Scenarios**:

1. **Given** Platform DB holds summary curriculum and ordered guided steps for an active Lab, **When** a learner requests lab summary, **Then** the response includes those steps in order (each with `payload` when present) and curriculum fields using the existing summary response shape; top-level recommended SQL fields are populated from step payloads when available.
2. **Given** Lab or Track status is not available for learner start (e.g. coming-soon), **When** a learner requests summary, **Then** existing availability gating still applies (forbidden / not startable) and no special bypass is introduced.
3. **Given** Index Playground content has been migrated to Platform DB, **When** the in-repo hardcoded summary registry is removed, **Then** learner summary for Index Playground still succeeds from Platform data alone with no runtime fallback to TypeScript content.
4. **Given** Index Playground steps have SQL in payloads, **When** a learner requests summary, **Then** `guidedSteps` for run/explain/create/drop actions include the recommended SQL in `payload`, and FE can Apply query from the step without reading only top-level fields.

---

### User Story 4 - Seed Index Playground Content Once (Priority: P1)

Operators (via migration/seed) get Index Playground’s current in-repo guided steps and curriculum written into Platform DB once so production/dev environments start with equivalent content. After seed, further edits go through admin APIs, not TypeScript edits.

**Why this priority**: Without a one-time migration of existing Index Playground content, switching the learner path to DB would empty or break the flagship lab.

**Independent Test**: Can be tested by applying the seed/migration on a clean Platform DB that already has the Index Playground Lab row, then verifying admin list steps and learner summary match the previously hardcoded curriculum (titles, order, actions, learning goal, recommended SQL).

**Acceptance Scenarios**:

1. **Given** a Platform DB with the Index Playground Lab catalog row and no prior flow content, **When** the seed/migration runs, **Then** guided steps and summary curriculum for that Lab are inserted with content equivalent to the prior in-repo Index Playground content.
2. **Given** the seed has already been applied (curriculum or any guided steps exist for Index Playground), **When** the migration/seed runs again, **Then** it skips seeding entirely and does not duplicate steps or overwrite admin-edited content.
3. **Given** seed completed, **When** an admin later edits a step title, **Then** that edit persists across subsequent deploys because re-seed is skipped once content exists.

---

### Edge Cases

- What happens when two steps are assigned the same display order? Stable secondary sort (e.g. by step id or created time) MUST be defined and applied consistently on admin list and learner summary.
- How does the system handle an unknown or unsupported action type on create/update? Reject with a clear validation error; do not persist.
- What if reorder omits some existing step ids or includes unknown ids? Reject the whole reorder; leave prior order unchanged.
- What if optional payload JSON is malformed or fails schema validation for the given action type? Reject with validation error detailing the field.
- What if admin deletes all steps for a Lab that still has summary curriculum? Learner summary may return an empty guidedSteps array; curriculum fields still return if present.
- Soft-hidden (`coming-soon`) Labs: admin MAY still manage steps/curriculum; learners remain gated by existing Lab/Track status rules.
- On curriculum partial update, omit means leave unchanged; explicit `null` on a nullable field clears it (e.g. recommended create/drop index SQL, optional benchmark note).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist guided steps per Lab on Platform DB with: display order, title, instruction, action type, and optional structured payload (primary home for per-step recommended SQL/DDL).
- **FR-002**: System MUST allow admins to create, update, list, get, delete, and reorder guided steps scoped to a Lab under `/api/v1/admin/*` with admin-only authorization.
- **FR-003**: System MUST persist lab summary curriculum as named fields per Lab on Platform DB sufficient to build learner lab summary without in-repo TypeScript content: learning goal, theory, dataset hint, quiz-required, optional benchmark note, and optional curriculum-level recommended query / create-index / drop-index SQL (compatibility + fallback).
- **FR-003a**: Guided-step `payload` is the **primary** source for Apply-query SQL on learner guided steps. Learner summary MUST include each step’s `payload`. Top-level response fields `recommendedQuery`, `recommendedCreateIndexSql`, and `recommendedDropIndexSql` MUST remain present and SHOULD be derived from the first matching step payload (actions `run_sql`/`run_explain`/`run_explain_analyze` → query; `create_index_sql` → create; `drop_index_sql` → drop), falling back to curriculum columns when step payload is absent.
- **FR-003b**: Known payload shapes: for `run_sql` / `run_explain` / `run_explain_analyze`, prefer `{ recommendedQuery: GuidedSql }`; for `create_index_sql` / `drop_index_sql`, prefer `{ sql: string }`; other actions may use `null` or opaque hints.- **FR-004**: System MUST allow admins to get, create, and partially update lab summary curriculum for a Lab under admin APIs with admin-only authorization. On update, omitted fields MUST remain unchanged; only sent fields are applied. For nullable curriculum fields, an explicit `null` MUST clear the stored value.
- **FR-004a**: Creating curriculum for a Lab that already has curriculum MUST fail with a clear conflict (or equivalent); further changes use partial update.
- **FR-005**: System MUST reject non-admin callers on all Lab Flow admin write/read admin endpoints with forbidden (or unauthorized if unauthenticated).
- **FR-006**: Learner `GET /labs/:labSlug/summary` MUST load guided steps and curriculum from Platform DB and MUST preserve the existing response field shape (no intentional FE-breaking rename/removal).
- **FR-007**: System MUST seed Index Playground’s prior in-repo summary content into Platform DB once. If curriculum or any guided steps already exist for that Lab, the seed MUST skip entirely (no upsert, no step replace).
- **FR-008**: After migration cutover, learner summary MUST read guided steps and curriculum from Platform DB only (hard cutover). In-repo hardcoded lab summary content MUST NOT be used as a runtime fallback for Index Playground or any other lab.
- **FR-009**: System MUST validate action types against a known allowed set (at minimum the actions already used by Index Playground: run SQL, explain/analyze, create/drop index SQL, compare metrics, take quiz, optional benchmark).
- **FR-010**: System MUST NOT write Lab Flow content to Playground (experiment) databases; Platform DB only.
- **FR-011**: Reorder MUST accept a complete ordered list of step identities for a Lab and apply it atomically or reject without partial updates.
- **FR-012**: Duplicate display-order values among steps of the same Lab are allowed; listing MUST use a deterministic secondary sort.

### Key Entities *(include if feature involves data)*

- **Lab Guided Step**: Ordered instructional unit belonging to exactly one Lab; attributes include order, title, instruction, action type, optional payload.
- **Lab Summary Curriculum**: Lab-scoped learning metadata stored as named fields (goal, theory, recommended query, recommended create/drop index SQL, dataset hint, quiz flag, optional notes) used to compose learner summary alongside steps and catalog Lab/Track fields. Create/drop index SQL fields may be null for labs that do not use them.
- **Lab** (existing): Parent catalog entity; steps and curriculum are scoped to it; slug remains the learner-facing key.
- **Action Type**: Controlled vocabulary describing the expected learner action for a step (not free-form execution of playground commands by the admin API itself).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can add, reorder, edit, and delete guided steps for a Lab and see the updated ordered list within one admin session without redeploying the application.
- **SC-002**: After seed, learner summary for Index Playground returns at least the same number of guided steps and the same learning goal text as the pre-migration curriculum (content-equivalent cutover).
- **SC-003**: 100% of admin Lab Flow write operations by non-admin users are rejected with no Platform content mutation.
- **SC-004**: Learner lab summary clients that already consume the current summary fields continue to work without required field renames (contract-compatible delivery).
- **SC-005**: Operators can change an Index Playground step instruction via admin API and observe the new text on the next learner summary request without editing application source.

## Assumptions

- Admin AuthZ (`Role.ADMIN` on `/api/v1/admin/*`) and Track & Lab Admin CRUD (Lab rows exist on Platform DB) are available.
- Index Playground Lab catalog row and learner summary gating (active Lab/Track) already behave as shipped in prior features.
- “Same response shape” means preserve existing learner summary field names and nesting; additive optional fields are allowed if needed, but removals/renames are out of scope.
- Hard cutover: after seed + deploy, remove or stop wiring the in-repo summary registry; missing Platform curriculum yields not-found (or equivalent), never a TypeScript fallback.
- Recommended SQL/DDL for the learner summary response are named curriculum fields; step payload is optional extras only and does not replace those fields.
- Index Playground seed skips entirely when that Lab already has curriculum or any guided steps (protects admin edits on re-deploy).
- Optional step payload is JSON suitable for action-specific hints (e.g. SQL text, parameters); the admin API validates structure lightly; it does not execute SQL.
- Hard delete of individual guided steps is allowed (unlike Track/Lab soft-hide); curriculum uses create-once then partial update (omit = leave unchanged; explicit `null` clears nullable fields), not full-document replace or versioning history.
- FE admin UI is out of scope; this feature ships backend APIs and seed only.
- Quiz question authoring remains Quiz Admin CRUD (separate feature); this feature only preserves `quizRequired` and the `take_quiz` step action as content metadata.
- Categories as a separate admin surface remain out of scope unless already implied by existing Lab catalog APIs.
