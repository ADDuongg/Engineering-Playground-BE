# Research: Quiz Admin CRUD

**Feature**: `023-quiz-admin-crud` | **Date**: 2026-07-12

## R1 — Reuse existing quiz tables vs new admin tables

**Decision**: Reuse Platform tables from Quiz Engine (`quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`). No new content tables. Extend repositories with write/reorder methods.

**Rationale**: Spec authors the same definitions learners already consume; dual tables would drift and break gating/`existsByLabId`.

**Alternatives considered**:

- Separate `admin_quiz_*` draft tables + publish — overbuilt for MVP; rejected
- Store full quiz JSON blob on labs — weak granular option CRUD/reorder; rejected

## R2 — Quiz-gating on shell create

**Decision**: Creating the quiz row immediately gates the Lab (existing `QuizGateAdapter` / `existsByLabId`). Empty quiz: learner definition may return empty `questions`; submit rejects when there are zero questions (or incomplete answers). Self-complete remains blocked until quiz deleted or a passing attempt exists.

**Rationale**: Clarification A; aligns with Quiz Engine “existence of quiz row = gated”.

**Alternatives considered**:

- Gate only when ≥1 valid question — diverges from 017; rejected
- Explicit publish flag — extra state machine; rejected for MVP

## R3 — Question create with inline options

**Decision**: `POST .../questions` requires `options: [{ label, sequenceOrder, isCorrect }, ...]` with ≥2 options and exactly one `isCorrect: true` in one transaction. No question row without options.

**Rationale**: Clarification; prevents orphan questions and enforces answer-key invariant at the only create path that can introduce a question.

**Alternatives considered**:

- Question then options separately — allows invalid interim states; rejected for create
- Full quiz replace document — conflicts with granular admin pattern; rejected

## R4 — Granular option CRUD after create

**Decision**: Separate option create/update/delete endpoints. Question PATCH updates `prompt` / `sequenceOrder` only (no full option replace). Option writes must leave the question with ≥2 options and exactly one correct, else reject and leave prior state.

**Rationale**: Clarification B; matches backlog “create/update/delete … options”.

**Alternatives considered**:

- Replace-all options on every question update — simpler code but worse authoring; rejected
- Dual mode (optional replace) — two APIs for one job; rejected

## R5 — Setting the correct option

**Decision**: When an option is created/updated with `isCorrect: true`, clear `isCorrect` on siblings in the same transaction so exactly one remains true. Setting the sole correct option to `false` without another becoming true → validation error. Deleting the sole correct option → validation error unless another option is already correct (impossible if deleting the only correct) → reject.

**Rationale**: Keeps single-select invariant without requiring clients to send the full option set.

**Alternatives considered**:

- Require client to send all option correctness flags on every change — brittle; rejected
- DB partial unique index only — still need app validation for ≥2 options; use app transaction + optional DB check later

## R6 — Hard delete quiz + attempts; keep completions

**Decision**: `DELETE` quiz hard-deletes quiz row; FK cascade removes questions, options, and attempts. Do **not** delete `user_lab_completions` (or equivalent Progress completion rows). Lab becomes non-gated via absence of quiz row.

**Rationale**: Clarifications on delete + completions; matches existing TypeORM `ON DELETE CASCADE` on attempts/questions/options.

**Alternatives considered**:

- Soft-delete / archive quiz — out of scope
- Block delete when attempts exist — rejected (clarification A)
- Revoke completions on delete — rejected (clarification keep completions)

## R7 — Admin module placement

**Decision**: `AdminQuizController` under `src/modules/admin/` with `@Roles(Role.ADMIN)`. Quiz write repositories live in `QuizModule` and are exported. Shared admin types in `src/shared/quiz/quiz-admin.ts`.

**Rationale**: Same pattern as Track/Lab admin and Lab Flow admin; learner `QuizController` stays untouched for definition/submit/result.

**Alternatives considered**:

- Admin routes on `QuizController` with role checks — mixes learner/admin surfaces; rejected
- Duplicate entities in admin module — violates feature ownership; rejected

## R8 — Empty quiz submit behavior

**Decision**: Ensure learner submit rejects empty quizzes with a clear validation/not-gradeable error (extend SubmitQuizUseCase if current code assumes ≥1 question without a clear error). Definition GET for empty quiz returns 200 with `questions: []` when quiz shell exists (consistent with gated-but-authoring).

**Rationale**: Clarification empty-shell gating; learners must not get opaque 500s.

**Alternatives considered**:

- Definition 404 until first question — would hide shell existence from FE; conflicts with gate-on-shell; rejected

## R9 — Migrations

**Decision**: No new tables expected. Only add a migration if write paths require a new index/constraint (e.g. optional partial unique for one correct option) — default MVP relies on transactional UseCase validation; skip DB constraint unless tests show need.

**Rationale**: Simplicity; 017 schema already sufficient.

**Alternatives considered**:

- Force DB unique partial index in this feature — nice hardening; defer unless easy and non-breaking
