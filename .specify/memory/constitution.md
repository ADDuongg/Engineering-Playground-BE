<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles: V (Learning-First UX — multi-track), VI (Platform vs Runtime Separation)
- Added sections: None
- Removed sections: None
- Templates requiring updates:
  - ⚠ .specify/templates/plan-template.md (Constitution Check gates — review Track awareness)
  - ⚠ .specify/templates/spec-template.md (constitution alignment note)
- Follow-up TODOs: None
-->

# Engineering Playground Constitution

## Core Principles

### I. Monorepo & Shared Contracts

All code lives in a single pnpm workspace. Shared API contracts, DTOs, and enums MUST
live in `packages/types` (and future shared packages). Apps MUST NOT duplicate types
across `apps/api` and `apps/web`. Cross-package imports MUST use workspace protocol
(`workspace:*`). New packages require a clear, documented purpose — no
organizational-only packages.

**Rationale**: One source of truth for contracts prevents API drift between NestJS
backend and React frontend.

### II. Feature-First Backend Architecture

Backend features follow **Controller → UseCase → Repository**. Controllers handle
HTTP only (routing, DTO binding, response mapping). Business logic MUST live in
UseCases. Data access MUST live in Repositories. Forbidden dependency directions:
Repository → Controller, Repository → Frontend, Worker → Controller.

**Rationale**: Predictable boundaries keep features independently maintainable and
testable in a growing monorepo.

### III. TypeScript Strict (NON-NEGOTIABLE)

`strict: true` and related flags in `tsconfig.base.json` MUST remain enabled for all
packages. `any` is forbidden except with an inline comment justifying why and a
follow-up task to remove it. Shared types MUST be exported from `@db-play/types` or
dedicated packages — not re-declared per app.

**Rationale**: Strict typing catches integration errors early across API and UI
boundaries.

### IV. Testing Standards

Every feature MUST include:

- **Unit tests** for UseCases and pure logic (Jest)
- **Integration tests** for API endpoints (Supertest + test DB where applicable)
- **E2E tests** for critical user journeys (auth, lab completion, experiment flow)

Tests MUST be deterministic and isolated. Playground experiments MUST NOT depend on
prior execution state. No feature is complete without passing tests. Prefer TDD for
UseCases: write failing tests → implement → refactor.

**Rationale**: A learning platform must be trustworthy; broken flows undermine
educational value.

### V. Learning-First UX

The product exists to teach engineering concepts through experimentation across
multiple Tracks (databases, React rendering, system design, caching, etc.).
Every user-facing surface MUST:

- Explain **what** is happening and **why** (not just show results)
- Surface **actionable, Track-aware errors** (e.g., "Sequential scan exceeded timeout
  because no index was available" — not "Query failed"; "Component re-rendered 47
  times because parent state changed" — not "Experiment failed")
- Keep primary learning tasks completable without unnecessary navigation
- Prioritize clarity over visual decoration

Frontend owns rendering, interaction, and visualization layout. Frontend MUST NOT
compute engineering metrics — metrics originate from the backend only.

**Rationale**: Educational outcomes drive design; misleading or opaque UX defeats
the platform's purpose.

### VI. Platform vs Runtime Separation

Two data domains MUST stay isolated:

- **Platform DB** (PostgreSQL): users, progress, quiz results, Tracks, Labs — permanent
- **Runtime state** (per Track): experiment data — disposable, resettable

Each Track declares its own **Runtime Adapter** (e.g. Playground PostgreSQL for
Database Track, Playground Redis for Redis Track, headless React sandbox for
React Rendering Track). Not every Track uses Playground PostgreSQL.

Never mix Platform and Runtime responsibilities. SQL MUST use parameterized queries
only. Heavy work (benchmarks, dataset reset, import/export) MUST run via workers
(BullMQ), never synchronously in HTTP handlers. Cache (Redis) is infrastructure —
UseCases MUST NOT depend on Redis semantics for correctness.

**Rationale**: Safe, reproducible experiments require isolation from permanent user
data.

### VII. Simplicity & Boring Architecture

Prefer extending existing modules over new abstractions. YAGNI applies: do not add
layers, packages, or patterns without a concrete current need. Keep architecture
boring; keep experiments exciting. Every Lab teaches exactly one engineering
concept within its Track. Adding a new Track requires only a Runtime Adapter,
Input Surface, Metric Catalog, and Visualization Kit — the experiment lifecycle
stays the same. Avoid premature optimization — measure first, then optimize with
verified impact.

**Rationale**: Long-term maintainability beats short-term speed; complexity compounds
in monorepos.

## Technology Stack & Constraints

| Layer | Stack | Notes |
|-------|-------|-------|
| Runtime | Node.js ≥ 22 | Enforced via `package.json` engines |
| Package manager | pnpm ≥ 10 | Workspace root scripts orchestrate apps |
| Backend | NestJS 11, TypeORM, PostgreSQL | Feature modules under `apps/api/src/modules/` |
| Frontend | React (planned `apps/web`) | Composable UI; shared `packages/ui`; pluggable Input Surfaces per Track |
| Contracts | `@db-play/types` | Single API envelope and shared DTOs |
| Cache / queues | Redis, BullMQ (future) | Workers for heavy jobs |
| API format | Standard envelope | `{ success, data, meta, error }` on all responses |

Mandatory API rules: every endpoint has DTO, validation, OpenAPI docs, integration
test, and structured error response. Never expose ORM entities directly. All
migrations via TypeORM — never modify production schema by hand.

Reference documents (subordinate to this constitution): `docs/engineering/ENGINEERING_GUIDE.md`,
`docs/engineering/ARCHITECTURE.md`, `docs/product/PRD.md`, `docs/engineering/DOMAIN.md`.

## Development Workflow & Quality Gates

Feature lifecycle (no stage may be skipped):

**Idea → Roadmap → Spec → Requirements → Design → Tasks → Implementation → Review →
Tests → Documentation → Merge**

Before implementation, read PRD, DOMAIN, ARCHITECTURE, ROADMAP, and the current feature
spec. Spec Kit artifacts live under `specs/[###-feature-name]/`.

**Definition of Done** — a feature is complete only when:

1. Implementation satisfies the spec and constitution
2. Unit, integration, and required E2E tests pass
3. API/docs updated (Swagger, spec, quickstart if applicable)
4. No duplicated logic, dead code, or unjustified complexity
5. PR answers: why, what problem, how tested, impact on existing Labs and Tracks

**Constitution Check gates** (for plans and reviews):

- [ ] Respects monorepo boundaries and shared types
- [ ] Follows Controller → UseCase → Repository
- [ ] TypeScript strict; no unjustified `any`
- [ ] Tests included per principle IV
- [ ] UX is learning-oriented with backend-sourced metrics
- [ ] Platform/Runtime separation preserved (per Track)
- [ ] No synchronous heavy work in request handlers

## Governance

This constitution supersedes ad-hoc practices and conflicting local conventions.
Amendments require:

1. Documented rationale and migration impact on in-flight specs
2. Version bump per semantic rules below
3. Propagation to dependent templates and `documents/ENGINEERING_GUIDE.md` when
   engineering rules change

**Versioning policy**:

- **MAJOR**: Principle removed or redefined incompatibly
- **MINOR**: New principle or materially expanded section
- **PATCH**: Wording clarifications without semantic change

All PRs and AI-generated plans MUST verify compliance with the Constitution Check
gates. Complexity beyond these principles MUST be recorded in the plan's Complexity
Tracking table with justification.

**Version**: 1.1.0 | **Ratified**: 2026-07-03 | **Last Amended**: 2026-07-03
