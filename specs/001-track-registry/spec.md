# Feature Specification: Track Registry

**Feature Branch**: `001-track-registry`

**Created**: 2026-07-08

**Status**: Done

**Input**: User description: "Define and store Track metadata on Platform DB so labs, browsers, and runners resolve the correct Runtime Adapter, Input Surface, Metric Catalog, and Visualization Kit."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover Available Learning Tracks (Priority: P1)

A learner opens the platform and wants to see which engineering domains they can explore. They view a catalog of Tracks with clear names, descriptions, and availability status so they can choose where to start learning.

**Why this priority**: Without a Track catalog, users cannot navigate the multi-track platform or understand what learning domains exist. This is the foundation for Track Browser, Lab Browser, and all downstream lab experiences.

**Independent Test**: Can be fully tested by calling the Track list capability and verifying that at least the Database / SQL Track appears with correct metadata and status. Delivers immediate value as a discoverable learning-domain index.

**Acceptance Scenarios**:

1. **Given** the platform is deployed with seeded Track data, **When** a user requests the Track catalog, **Then** they receive a list containing the Database / SQL Track with slug, name, description, and `active` status.
2. **Given** Phase 2 and Phase 4 Tracks are seeded as coming-soon, **When** a user requests the Track catalog, **Then** those Tracks appear with `coming-soon` status and are distinguishable from active Tracks.
3. **Given** a user is not authenticated, **When** they request the Track catalog, **Then** they still receive the public Track list (read-only discovery).

---

### User Story 2 - Resolve Track Configuration for Experiments (Priority: P1)

When a lab or experiment runner needs to execute work for a specific Track, the system looks up that Track's configuration to determine which Runtime Adapter, Input Surface, Metric Catalog, and Visualization Kit apply.

**Why this priority**: Experiment execution and Lab Shell rendering depend on Track-specific configuration. Incorrect resolution would break experiments or show wrong UI panels.

**Independent Test**: Can be tested by requesting a single Track by slug and verifying the response includes runtime adapter type, input surface type, metric catalog identifier, and visualization kit identifier for the Database / SQL Track.

**Acceptance Scenarios**:

1. **Given** the Database / SQL Track exists, **When** the system resolves Track configuration by slug `database-sql`, **Then** it returns runtime adapter type for Playground PostgreSQL, input surface type for SQL editor, and references to the Database Track metric catalog and visualization kit.
2. **Given** a Track slug does not exist, **When** the system attempts resolution, **Then** the user receives a clear not-found response explaining the Track is unavailable.
3. **Given** a Track has `coming-soon` status, **When** a user requests its configuration, **Then** metadata is returned but the response indicates the Track is not yet available for lab entry.

---

### User Story 3 - Platform Maintains Authoritative Track Catalog (Priority: P2)

Platform operators rely on a single authoritative catalog stored on the permanent Platform database. Track definitions are not mixed with disposable playground experiment state and survive playground resets.

**Why this priority**: Ensures data integrity and aligns with platform vs runtime separation. Lower priority than user-facing discovery because seed data satisfies MVP; admin CRUD is out of scope for this feature.

**Independent Test**: Can be tested by verifying Track records persist in Platform DB, are populated via seed migration, and are unaffected by playground reset operations.

**Acceptance Scenarios**:

1. **Given** Track seed data is applied, **When** playground runtime state is reset, **Then** Track catalog records remain unchanged.
2. **Given** MVP deployment, **When** operators inspect Platform DB, **Then** they find Track records with stable slugs suitable for API and routing references.

---

### Edge Cases

- What happens when the Track catalog is empty (seed not run)? The list endpoint returns an empty array with a success response; single-Track lookup returns not-found.
- How does the system handle duplicate Track slugs? Slugs MUST be unique; seed and validation prevent duplicates at catalog write time.
- What happens when a downstream consumer requests configuration for a `coming-soon` Track to start a lab? Lab entry MUST be blocked with a user-friendly message that the Track is not yet available.
- How are Tracks ordered in the catalog? Tracks are returned in a stable, predictable order (display order field, then name) so UI lists do not shuffle between requests.
- What happens under concurrent read load? Track catalog reads are idempotent; multiple simultaneous list requests return consistent data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist Track metadata on the Platform database (permanent data domain), separate from playground runtime state.
- **FR-002**: Each Track MUST have a unique slug, human-readable name, description, status (`active` or `coming-soon`), and display order.
- **FR-003**: Each Track MUST declare configuration for: runtime adapter type, input surface type, metric catalog reference, and visualization kit reference.
- **FR-004**: System MUST seed the MVP catalog with the Database / SQL Track as `active`.
- **FR-005**: System MUST seed coming-soon placeholder Tracks for Caching & Concurrency and Frontend Performance so discovery UI can show future domains.
- **FR-006**: System MUST expose a read-only API to list all Tracks for browser and catalog consumers.
- **FR-007**: System MUST expose a read-only API to retrieve a single Track by slug, including full configuration metadata.
- **FR-008**: Track list and detail endpoints MUST be accessible without authentication for public discovery (authenticated users receive the same catalog).
- **FR-009**: System MUST return structured, learner-friendly error responses when a Track slug is not found.
- **FR-010**: `coming-soon` Tracks MUST be included in list responses but MUST NOT be treated as lab-startable without an explicit availability flag or status check by consumers.
- **FR-011**: Track configuration references (metric catalog, visualization kit) MUST use stable identifiers resolvable by downstream lab and runner modules without hardcoding Track-specific logic in the registry itself.
- **FR-012**: System MUST NOT expose raw database entities directly in API responses; responses use validated DTOs with the standard API envelope.

### Key Entities

- **Track**: A learning domain on the platform. Attributes: slug (unique identifier), name, description, status (`active` | `coming-soon`), display order, runtime adapter type, input surface type, metric catalog reference, visualization kit reference. Stored on Platform DB.
- **Runtime Adapter Type**: Declarative identifier for which experiment runtime a Track uses (e.g., playground PostgreSQL, playground Redis, headless React sandbox).
- **Input Surface Type**: Declarative identifier for how users interact in the Lab Shell middle panel (e.g., SQL editor, command panel, component sandbox).
- **Metric Catalog Reference**: Stable key pointing to the set of metrics a Track produces.
- **Visualization Kit Reference**: Stable key pointing to the chart/visualization types available for a Track's metrics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can retrieve the full Track catalog in under 1 second under normal load (p95).
- **SC-002**: 100% of seeded MVP Tracks (Database / SQL active, plus coming-soon placeholders) appear correctly in list and detail responses after deployment.
- **SC-003**: Downstream modules can resolve Runtime Adapter and Input Surface for the Database / SQL Track using only registry data, without Track-specific hardcoding in the registry module.
- **SC-004**: Track catalog data remains intact after any playground reset operation (zero data loss for Platform DB Track records).
- **SC-005**: Unauthenticated and authenticated users receive identical Track catalog content for discovery purposes.

## Assumptions

- MVP Track catalog is seed-driven; admin create/update/delete APIs for Tracks are out of scope for this feature.
- Lab and Category entities are separate backlog features; this feature stores Track-level metadata only (lab count on Track Browser is computed later when Lab catalog exists).
- Metric catalog and visualization kit definitions are referenced by identifier; full catalog content may live in code or separate configuration artifacts resolved at plan/implementation time.
- Public read access for Track listing aligns with Landing Page and Track Browser discovery before sign-in.
- Three Tracks are seeded for MVP visibility: Database / SQL (`active`), Caching & Concurrency (`coming-soon`), Frontend Performance (`coming-soon`).
