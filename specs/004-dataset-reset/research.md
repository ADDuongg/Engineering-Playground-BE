# Research: Dataset Reset

**Feature**: 004-dataset-reset | **Date**: 2026-07-08

## 1. Reset vs Re-prepare

**Decision**: Reset is a dedicated orchestration path (`ResetDatasetUseCase`) that runs teardown then `DatasetSeedRunner.run()` — not a thin alias to `PrepareDatasetUseCase.execute()`.

**Rationale**: Prepare path optimizes for first load (skips redundant work when already ready). Reset must always tear down mutations even when status is `ready`. Separate use case enforces FR-003 artifact removal and distinct `resetting` lifecycle.

**Alternatives considered**:
- **Prepare with `force: true` flag**: Conflates two user journeys; harder to audit; rejected.
- **TRUNCATE-only refresh**: Leaves learner-created indexes and extra tables; rejected.

## 2. Playground Teardown Strategy

**Decision**: `DatasetPlaygroundTeardown` executes in order: (1) query `information_schema.tables` in `public` schema for tables not listed in manifest baseline tables → `DROP TABLE … CASCADE`; (2) delegate to `DatasetSeedRunner` which runs `schema.sql` (scoped drops + recreate) and tier seed SQL in a transaction.

**Rationale**: `schema.sql` already drops known commerce tables CASCADE, removing learner indexes on those tables. Extra tables created during experiments require dynamic discovery. Manifest table list is the allowlist for what may remain after teardown preamble.

**Alternatives considered**:
- **DROP SCHEMA public CASCADE**: Too destructive; may affect playground extensions; rejected.
- **schema.sql only**: Insufficient for learner-created tables; rejected.
- **Full database snapshot restore**: Requires infra not in MVP; rejected.

## 3. Status Lifecycle

**Decision**: Add `resetting` to `DatasetReadinessStatus`. Reuse `DatasetPreparationStatusStore` and Redis key `dataset:prep:{family}:{version}:{tier}` — same identity scope as prepare.

**Rationale**: Metadata and experiment runner already key off this store. Single source of truth avoids split status. `resetting` satisfies spec FR-005 without a parallel Redis namespace.

**Alternatives considered**:
- **Separate `dataset:reset:*` keys**: Duplicate polling endpoints and metadata confusion; rejected.
- **Map reset to `preparing`**: Fails audit and UX distinction; rejected.

## 4. Concurrency and Conflicts

**Decision**: If status is `preparing` or `resetting` for the identity, return existing in-flight status (no parallel operation). Reset requested while status is `not_started` proceeds (teardown + seed equivalent to prepare). Reset while another tier's identity is unrelated — independent keys.

**Rationale**: FR-007 prevents conflicting operations. Matches prepare deduplication pattern learners already experience.

**Alternatives considered**:
- **Queue reset behind prepare**: Adds complexity without MVP need; rejected.
- **Always reject if not `ready`**: Blocks reset after failed prepare when retry would help; rejected.

## 5. Sync vs Async Tier Threshold

**Decision**: Reuse `dataset.syncTierMax` configuration from Dataset Loader. 100K reset runs synchronously in request; 1M/10M return `202` with `resetting` and complete in background.

**Rationale**: Consistent UX with prepare; operators tune one threshold. Meets SC-003 for 100K.

**Alternatives considered**:
- **Always async reset**: Worse UX for fast 100K restore; rejected.
- **Separate reset tier config**: Unnecessary duplication; rejected.

## 6. HTTP API Surface

**Decision**: Add to existing `DatasetLoaderController` under `/datasets`:
- `POST /datasets/reset` — trigger reset
- `GET /datasets/reset/status` — poll reset status (same payload shape as prepare status)

**Rationale**: Lab shells already integrate with `/datasets`. Reset is a sibling operation to prepare on the same resource identity.

**Alternatives considered**:
- **DELETE /datasets/:family**: Non-idempotent semantics unclear for async; rejected.
- **Separate controller module**: Extra wiring without boundary benefit; rejected.

## 7. Audit Logging

**Decision**: Structured log event `dataset_reset` with fields: `family`, `version`, `tier`, `status` (`started` | `completed` | `failed`), `durationMs`, `requestId`, `labSlug`, `errorCode`. No query text or seed SQL content.

**Rationale**: FR-010 and US5. Mirrors `dataset_preparation` logging for operational consistency.

**Alternatives considered**:
- **Platform DB audit table**: Audit Log feature is P2 and not implemented; deferred.
- **Reuse `dataset_preparation` event name**: Conflates operations in log queries; rejected.

## 8. Sandbox Query Conflict (FR-014)

**Decision**: MVP does not block reset on active sandbox queries — playground uses shared connection pool; `schema.sql` transactional reload may fail if locks held, surfacing as retriable `RESET_LOCK_CONFLICT` with educational hint. Future Experiment Runner may expose in-flight query registry for hard deferral.

**Rationale**: SQL Sandbox and Experiment Runner are not complete; no reliable in-flight query registry exists. Fail-safe with clear error meets FR-012 without blocking MVP delivery.

**Alternatives considered**:
- **Global playground advisory lock**: Adds coupling and deadlock risk; deferred.
- **Silent wait for query completion**: Unbounded HTTP delay; rejected.

## 9. Metadata After Reset

**Decision**: On successful reset, status store marks `ready`; `GetDatasetMetadataUseCase` returns live counts from playground (unchanged contract).

**Rationale**: FR-011. No separate metadata invalidation layer needed.

**Alternatives considered**:
- **Cache invalidation service**: Over-engineered for current metadata path; rejected.
