# Feature Specification: Dataset Reset

**Feature Branch**: `004-dataset-reset`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Reset Playground PostgreSQL to a clean baseline so Database Track experiments remain isolated and repeatable. Reset playground schema and seed data on demand. Guarantee no cross-experiment state leakage. Complete reset within acceptable time bounds for lab UX. Audit reset events for troubleshooting."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-08

No clarification questions required. Spec completed with documented assumptions for reset scope (active lab dataset identity only), coordination with Dataset Loader seed artifacts, platform/playground isolation, and MVP async behavior pending Worker Queue Foundation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner Restores Baseline After Experiment Changes (Priority: P1)

A learner runs SQL experiments that modify playground data — inserting rows, creating indexes, or altering tables. When results no longer match the lesson baseline or the learner wants a fresh start, they trigger a dataset reset. The platform tears down the modified playground state and reloads the lab's configured dataset (family, tier, version) to the same deterministic baseline as initial preparation.

**Why this priority**: Without on-demand reset, experiment mutations leak across attempts and undermine learning reproducibility. This is the core value of the feature.

**Independent Test**: Modify playground tables during a lab session, trigger reset, and verify table structures and row counts match the documented baseline for the lab's dataset identity.

**Acceptance Scenarios**:

1. **Given** a learner has modified playground data during an experiment, **When** they request a dataset reset for the active lab dataset, **Then** all lab tables return to the documented baseline state for the configured family, tier, and version.
2. **Given** a reset completes successfully, **When** the learner runs the same reference query used before modifications, **Then** results match the pre-experiment baseline within documented tolerance.
3. **Given** a lab session has a ready dataset, **When** reset is requested, **Then** the learner receives explicit feedback that reset is in progress and when it completes (or fails with guidance).
4. **Given** reset completes, **When** the learner views dataset metadata, **Then** row counts and readiness reflect the restored baseline, not the pre-reset mutated state.

---

### User Story 2 - No Cross-Experiment State Leakage (Priority: P1)

A learner finishes one experiment pattern (e.g., creates a custom index) and starts a new attempt or follows the lab's "try again" flow. Reset ensures no artifacts from the prior attempt — extra indexes, inserted rows, dropped constraints, or session-local objects — remain visible to subsequent queries.

**Why this priority**: State leakage directly corrupts learning outcomes and makes before/after comparisons meaningless.

**Independent Test**: Apply a known set of mutations (CREATE INDEX, INSERT, ALTER), reset, and verify none of the mutations persist in schema or data.

**Acceptance Scenarios**:

1. **Given** a learner created additional indexes during an experiment, **When** reset completes, **Then** only indexes defined in the baseline schema remain.
2. **Given** a learner inserted or updated rows in baseline tables, **When** reset completes, **Then** row counts and sample key distributions match the tier specification.
3. **Given** a learner created tables or objects outside the lab dataset, **When** reset completes, **Then** those objects are removed and only lab dataset tables exist.
4. **Given** two consecutive resets for the same dataset identity, **When** both complete, **Then** the resulting playground state is equivalent in structure and counts.

---

### User Story 3 - Platform Data Remains Untouched (Priority: P1)

Platform operators and learners rely on permanent records — user progress, Track catalog, lab configuration, quiz results — stored outside the playground runtime. Reset operations affect only disposable experiment data.

**Why this priority**: Violating platform/playground separation is a constitutional violation and would destroy user trust and progress.

**Independent Test**: Record Platform DB row counts for tracks and progress tables before and after reset; verify zero change while playground state is restored.

**Acceptance Scenarios**:

1. **Given** Track and lab catalog records exist on the platform, **When** any dataset reset runs, **Then** platform catalog and user progress records are unchanged.
2. **Given** dataset preparation status is tracked for a lab session, **When** reset completes, **Then** readiness reflects `ready` with baseline metadata — not a stale `failed` state from the prior mutation phase unless reset itself failed.
3. **Given** a reset is audited, **When** support reviews logs, **Then** logs reference dataset identity and outcome only — never learner query text or platform PII beyond session identifiers already used for tracing.

---

### User Story 4 - Reset Completes Within Learner-Acceptable Time (Priority: P2)

Learners expect reset to feel responsive enough to stay in flow. Smaller tiers reset quickly; larger tiers may take longer but always show progress rather than blocking silently.

**Why this priority**: UX matters for adoption but reset correctness is more critical than speed.

**Independent Test**: Measure reset duration for 100K tier under normal load and verify completion within the documented target while returning non-blocking status for larger tiers.

**Acceptance Scenarios**:

1. **Given** a lab uses the 100K tier, **When** reset is requested under normal platform load, **Then** reset completes within 30 seconds in at least 95% of observations.
2. **Given** a lab uses a large tier (1M or 10M), **When** reset is requested, **Then** the learner immediately receives a resetting status and can continue viewing guidance while reset runs to completion.
3. **Given** reset exceeds expected duration, **When** the learner checks status, **Then** they see that reset is still in progress rather than an ambiguous idle state.

---

### User Story 5 - Reset Events Are Auditable (Priority: P2)

Support engineers and operators troubleshoot learner-reported issues ("my data looks wrong") by reviewing structured reset audit records without accessing raw playground internals.

**Why this priority**: Operational visibility supports production reliability but does not block core learner reset flows.

**Independent Test**: Trigger reset, then verify a structured audit log entry exists with dataset identity, outcome, duration, and correlation identifiers.

**Acceptance Scenarios**:

1. **Given** a reset is requested, **When** reset starts, completes, or fails, **Then** a structured audit event is recorded with family, tier, version, status, and duration.
2. **Given** a reset fails, **When** support reviews the audit entry, **Then** they see an actionable error category and hint suitable for learner-facing messaging.
3. **Given** multiple resets occur concurrently for different dataset identities, **When** audit logs are queried, **Then** each event is distinguishable by correlation identifiers without cross-contamination.

---

### Edge Cases

- What happens when reset is requested while an experiment query is still running? The system rejects or queues reset until the playground is safe to tear down, and the learner receives clear guidance — never a partial teardown mid-query.
- What happens when reset is requested while dataset preparation is already in progress? The system resolves to a single authoritative lifecycle (no parallel conflicting load and reset) and reports coherent status.
- What happens when reset fails partway through? The playground must not present a half-reset state as ready; the session reports failure with retry guidance, and a subsequent attempt starts from a clean reset path.
- What happens when the lab references an invalid or removed dataset version? Validation rejects before reset begins with the same educational errors as Dataset Loader preparation.
- What happens when a learner triggers reset repeatedly in quick succession? Duplicate in-flight resets for the same dataset identity are deduplicated or rejected with status of the active operation — not parallel conflicting teardowns.
- What happens when no dataset was ever prepared for the session? Reset either prepares baseline from scratch (equivalent outcome) or returns a clear not-ready error — never an empty ambiguous playground presented as reset-complete.
- What happens when playground connectivity is lost during reset? The operation fails with a retriable error; readiness moves to `failed` until a successful reset or prepare completes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST reset only playground runtime data — never platform database records (users, progress, tracks, labs, quiz results).
- **FR-002**: System MUST restore the active lab's configured dataset identity (family, tier, version) to the same deterministic baseline produced by Dataset Loader preparation.
- **FR-003**: System MUST remove experiment-side effects including learner-created indexes, inserted/updated/deleted rows, and objects outside the baseline schema before or as part of reload.
- **FR-004**: System MUST support on-demand reset triggered by lab session consumers without requiring a full platform restart.
- **FR-005**: System MUST report reset lifecycle state (not started, resetting, ready, failed) so lab shells can guide learners through the operation.
- **FR-006**: System MUST validate dataset identity (family, tier, version) before reset begins and return educational errors for invalid combinations.
- **FR-007**: System MUST prevent parallel conflicting reset and preparation operations for the same dataset identity scope.
- **FR-008**: System MUST complete 100K-tier reset within a learner-acceptable window (under 30 seconds under normal platform load) for interactive lab flows.
- **FR-009**: System MUST allow downstream experiment execution features to assume a ready baseline only when reset or preparation readiness state is `ready`.
- **FR-010**: System MUST emit structured audit events for reset start, completion, and failure including dataset identity, duration, outcome, and request correlation identifiers.
- **FR-011**: System MUST update dataset metadata and readiness exposed to labs after successful reset so catalogs reflect restored baseline counts.
- **FR-012**: System MUST fail safely — a failed reset MUST NOT mark the dataset as `ready` or leave undocumented partial state presented as baseline.
- **FR-013**: System MUST reuse the same published seed artifacts and version pinning semantics as Dataset Loader so reset and initial prepare produce equivalent outcomes.
- **FR-014**: System MUST reject or defer reset when an active sandboxed query holds playground resources, with an actionable message to retry after the query completes.

### Key Entities

- **Reset Request**: A scoped request to restore playground baseline for a dataset identity, optionally tied to lab session context (lab slug, request id).
- **Reset Status**: Lifecycle record for an in-flight or completed reset — mirrors preparation readiness semantics (resetting, ready, failed) for the active dataset identity.
- **Dataset Identity**: The combination of family, tier, and version that defines which baseline artifacts to restore (shared with Dataset Loader).
- **Reset Audit Event**: A structured, append-only operational record of reset attempts for troubleshooting — distinct from learner-facing progress UI.
- **Playground Baseline**: The deterministic schema and seed content for a dataset identity after successful reset or preparation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of automated tests confirm that after reset, playground table structures and row counts match the documented tier specification within 1% tolerance.
- **SC-002**: 100% of automated tests confirm platform database records are unchanged after any reset operation.
- **SC-003**: 95% of 100K-tier resets complete within 30 seconds under normal platform load.
- **SC-004**: Zero experiment artifacts (learner-created indexes, extra tables, or net row deltas beyond tier spec) remain after successful reset in reproducibility test suites.
- **SC-005**: 100% of reset attempts produce a corresponding audit event with outcome and duration within 5 seconds of terminal state.
- **SC-006**: 90% of learners who trigger reset after modifying data can successfully run the lab's baseline verification step on first retry without support intervention (measured via lab UX review or structured usability check).

## Assumptions

- Dataset Loader is complete and provides manifest resolution, seed artifacts, preparation status, and metadata contracts consumed by this feature.
- Reset restores the same dataset identity already configured for the lab session — learners do not pick a different family or tier during reset in MVP.
- Full per-session physical database isolation is owned by Experiment Isolation; Dataset Reset restores baseline content within the shared playground runtime context available to the lab.
- MVP may execute reset synchronously for smaller tiers and return immediate `resetting` status for larger tiers using the same tier thresholds as Dataset Loader until Worker Queue Foundation routes all heavy resets through workers.
- Authentication and per-user rate limits apply to reset triggers but do not change which baseline is restored.
- Lab shells expose a "Reset dataset" action; this feature owns backend reset orchestration, not button placement or visual design.
- Re-preparing via Dataset Loader after reset is an implementation detail as long as the learner-visible outcome matches baseline restoration requirements.
