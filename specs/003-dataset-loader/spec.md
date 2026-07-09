# Feature Specification: Dataset Loader

**Feature Branch**: `003-dataset-loader`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Load platform-provided datasets into Playground PostgreSQL so every Database Track experiment starts from a known, reproducible state. Load predefined datasets (users, orders, products, logs, payments). Support dataset versioning and size tiers (100K / 1M / 10M). Prepare deterministic playground state per experiment session. Expose dataset metadata to labs without user uploads."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-08

No clarification questions required. Spec completed with documented assumptions for MVP commerce dataset family, tier definitions (100K / 1M / 10M), version pinning, and scope boundaries vs Dataset Reset and Experiment Isolation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lab Starts With Known Baseline Data (Priority: P1)

A learner opens a Database Track lab that teaches query patterns against commerce-style data. Before any SQL experiment runs, the platform ensures the playground contains the lab's predefined dataset — with tables such as users, orders, products, logs, and payments populated to a known baseline — so the learner can focus on SQL concepts instead of inventing or importing data.

**Why this priority**: No Database Track experiment can run meaningfully until baseline playground data exists. This is the foundation for Experiment Runner, Explain Runner, and every SQL lab.

**Independent Test**: Open a lab configured for the standard commerce dataset, trigger dataset preparation, and verify all expected tables exist with documented baseline row counts before the first query executes.

**Acceptance Scenarios**:

1. **Given** a learner enters a Database Track lab that requires the commerce dataset, **When** the lab session prepares the playground, **Then** all predefined tables (users, orders, products, logs, payments) are present and queryable.
2. **Given** a lab session prepares the playground for the first time, **When** preparation completes successfully, **Then** the learner receives confirmation that the dataset is ready to use (directly or via lab shell state).
3. **Given** preparation has already completed for the requested dataset identity in the current session context, **When** the learner runs an experiment, **Then** the platform does not redundantly reload from scratch unless the lab or session explicitly requires a fresh load.
4. **Given** a learner attempts to upload their own data file, **When** they interact with the lab, **Then** no upload path is offered — only platform-provided datasets are available.

---

### User Story 2 - Size Tiers Support Realistic Scale Experiments (Priority: P1)

A learner works through pagination or index labs where performance behavior depends on data volume. The lab declares a size tier (100K, 1M, or 10M rows at the appropriate grain). The platform loads the matching tier so experiments demonstrate realistic differences in scan cost, latency, and plan shape at each scale.

**Why this priority**: Scale is a core learning objective for Database Track labs (OFFSET vs cursor, index impact, sequential scans). Without tiered datasets, performance lessons cannot be reproduced reliably.

**Independent Test**: Configure the same lab for two different tiers and verify row counts and relative data distributions match the tier definition within documented tolerance.

**Acceptance Scenarios**:

1. **Given** a lab is configured for the 100K tier, **When** dataset preparation completes, **Then** aggregate row counts match the 100K tier specification documented for that dataset.
2. **Given** a lab is configured for the 1M tier, **When** dataset preparation completes, **Then** aggregate row counts match the 1M tier specification and exceed the 100K tier counts for the same dataset family.
3. **Given** a lab is configured for the 10M tier, **When** dataset preparation completes, **Then** aggregate row counts match the 10M tier specification.
4. **Given** a learner switches tier within a lab that supports tier selection, **When** they request the new tier, **Then** the playground is prepared with the new tier's data and the learner is informed that preparation may take longer for larger tiers.

---

### User Story 3 - Labs Receive Dataset Metadata Without Raw Seeds (Priority: P2)

The lab shell and learning UI need to show learners what data is available — table names, human-readable descriptions, approximate row counts, active tier, and dataset version — without exposing seed scripts or requiring learners to discover schema by trial and error.

**Why this priority**: Metadata improves learning clarity ("you are querying 1M orders") but labs can technically run once baseline data exists. Lower priority than loading itself.

**Independent Test**: After preparation, request dataset metadata for the active lab session and verify the catalog matches the tables and counts actually present in the playground.

**Acceptance Scenarios**:

1. **Given** a dataset has been prepared for a lab session, **When** the lab shell requests dataset metadata, **Then** it receives a structured catalog of tables, descriptions, and row counts for the active tier.
2. **Given** metadata is returned, **When** a learner views the dataset overview panel, **Then** they see educational context (what each table represents) without access to raw seed files or platform-internal storage paths.
3. **Given** a dataset version is active, **When** metadata is returned, **Then** the version identifier is included so support and reproducibility checks can reference the exact dataset generation.

---

### User Story 4 - Versioned Datasets Stay Reproducible (Priority: P2)

Platform engineers publish dataset updates (schema tweaks, distribution fixes) under new version identifiers. Labs pin to a version so lesson materials, expected query outcomes, and quiz answers remain stable until the lab is intentionally upgraded.

**Why this priority**: Versioning prevents silent drift in learning outcomes but initial MVP can ship with a single active version per dataset family.

**Independent Test**: Prepare the same lab with the same version and tier twice (with an intervening reset) and verify equivalent table structures and row counts.

**Acceptance Scenarios**:

1. **Given** a lab pins dataset version `v1`, **When** preparation runs, **Then** the playground is loaded from version `v1` artifacts regardless of newer platform versions existing.
2. **Given** a lab references a dataset version that no longer exists, **When** preparation is requested, **Then** the learner receives a clear, actionable error explaining the dataset is unavailable (not a generic failure).
3. **Given** two preparation runs for the same lab, tier, and version, **When** both complete, **Then** table structures and row counts are equivalent within documented tolerance.

---

### Edge Cases

- What happens when dataset preparation fails partway through? The playground must not be left in a half-loaded state that misleads learners; the session reports failure with guidance to retry, and a subsequent attempt starts from a clean preparation path (coordination with Dataset Reset is a separate feature, but failed loads must not present partial data as ready).
- What happens when a lab references an unknown dataset family or tier? Validation rejects before preparation with a clear configuration error.
- What happens when multiple learners prepare datasets concurrently? Preparation must not corrupt playground state or platform metadata; concurrent access is bounded so shared infrastructure remains stable.
- What happens when preparation for a large tier exceeds learner patience? The learner sees an explicit preparing state with progress or time guidance rather than a silent hang.
- What happens when playground tables from a prior experiment differ from the requested dataset? Preparation reconciles to the requested dataset identity or fails clearly — learners must not unknowingly query stale tables from a different lab context.
- What happens when metadata is requested before preparation completes? The system returns a not-ready state rather than stale or empty catalog data presented as authoritative.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST load only platform-defined datasets into the playground runtime — never user-uploaded files (PRD §14).
- **FR-002**: System MUST support the predefined commerce dataset family with tables for users, orders, products, logs, and payments as the MVP baseline.
- **FR-003**: System MUST support size tiers of 100K, 1M, and 10M rows (at the grain defined per table in dataset documentation) for each supported dataset family.
- **FR-004**: System MUST assign and honor dataset version identifiers so labs can pin reproducible dataset generations.
- **FR-005**: System MUST prepare deterministic playground state for a given combination of dataset family, tier, and version — repeated preparation yields equivalent structures and counts within documented tolerance.
- **FR-006**: System MUST expose structured dataset metadata (tables, descriptions, row counts, tier, version, readiness status) to lab consumers without revealing raw seed artifacts.
- **FR-007**: System MUST keep dataset data exclusively in the playground runtime — never persist experiment datasets in the platform database.
- **FR-008**: System MUST validate lab dataset configuration (family, tier, version) before preparation begins and return educational errors for invalid combinations.
- **FR-009**: System MUST report dataset readiness state (not started, preparing, ready, failed) so lab shells can guide learners through the preparation phase.
- **FR-010**: System MUST complete 100K-tier preparation within a learner-acceptable window (under 30 seconds under normal platform load) so labs feel interactive.
- **FR-011**: System MUST allow downstream experiment execution features to assume a ready dataset only when readiness state is `ready`.
- **FR-012**: System MUST log preparation events (dataset family, tier, version, outcome, duration) for troubleshooting without logging sensitive learner query content.

### Key Entities

- **Dataset Family**: A named, platform-curated collection of related tables and seed logic (e.g., commerce baseline with users, orders, products, logs, payments). Labs reference a family, not ad-hoc table lists.
- **Dataset Tier**: A scale variant within a family (100K, 1M, 10M) defining target row volumes and distributions for performance-oriented labs.
- **Dataset Version**: An immutable identifier for a published generation of a family+tier artifact set; labs pin versions for reproducibility.
- **Dataset Metadata Catalog**: A learner-facing description of the active dataset — tables, column summaries, row counts, tier, version, and readiness — consumed by lab shells.
- **Preparation Session Context**: The scope (lab session or experiment session) for which a dataset identity is requested, prepared, and tracked through readiness lifecycle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Database Track labs configured with a valid dataset family can reach a `ready` preparation state without learner data uploads.
- **SC-002**: 95% of 100K-tier preparations complete within 30 seconds under normal platform load.
- **SC-003**: For any supported tier, row counts reported in metadata deviate by no more than 1% from the documented tier specification after successful preparation.
- **SC-004**: Re-running preparation for the same family, tier, and version produces equivalent table structures and row counts in 100% of automated reproducibility tests.
- **SC-005**: 90% of learners viewing dataset metadata can identify which tables are available and their approximate scale without running exploratory SQL first (measured via lab UX review or structured usability check).
- **SC-006**: Zero platform database tables store playground seed row data — dataset content remains runtime-only.

## Assumptions

- MVP ships one primary dataset family (commerce: users, orders, products, logs, payments); additional families follow the same loader contract later.
- Each lab declares its required dataset family, tier, and version via platform configuration — learners do not freely mix arbitrary datasets in MVP.
- Full per-session physical database isolation is owned by the Experiment Isolation feature; Dataset Loader focuses on loading the correct predefined content into the playground runtime context available to the lab.
- Dataset Reset (separate feature) handles tearing down and restoring baseline state on demand; Dataset Loader owns initial load and tier/version selection.
- Large-tier (1M, 10M) preparation may take longer than 100K; learners always see explicit preparing feedback rather than blocking silently.
- A single active default version per family exists at MVP launch; version pinning infrastructure is built so labs can adopt explicit pins without rework.
- Authentication and per-user rate limits apply to preparation triggers but do not change which datasets are available to a lab.
- Seed artifacts are maintained by platform operators offline; learners and lab authors interact only with metadata and readiness APIs.
