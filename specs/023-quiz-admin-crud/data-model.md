# Data Model: Quiz Admin CRUD

**Feature**: `023-quiz-admin-crud` | **Date**: 2026-07-12

Platform DB only. No playground tables. Schema owned by Quiz Engine (017); this feature adds **write/reorder semantics** and admin views.

## Lab (existing — unchanged)

Table: `labs` — catalog from 021. Quiz references `labs.id`.

---

## Quiz (existing)

Table: `quizzes` — **1:1** with Lab.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| lab_id | uuid | unique, FK → labs ON DELETE CASCADE | One quiz per Lab |
| title | varchar(200) | nullable | Optional; clear via PATCH null |
| created_at / updated_at | timestamptz | | |

### Quiz validation / lifecycle

| Event | Result |
|-------|--------|
| Admin create | Insert if Lab exists and no quiz yet; else `NOT_FOUND` / `CONFLICT` |
| Admin PATCH title | Partial; omit unchanged; `null` clears title |
| Admin DELETE | Hard delete quiz → cascade questions, options, attempts; **do not** touch lab completions |
| Existence | Lab is quiz-gated (Progress gate) |
| Zero questions | Allowed; submit rejected; self-complete blocked |

---

## Quiz Question (existing)

Table: `quiz_questions`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| quiz_id | uuid | FK → quizzes ON DELETE CASCADE | |
| prompt | text | NOT NULL | |
| question_type | varchar(32) | NOT NULL | MVP: `single_select` only |
| sequence_order | int | NOT NULL | Display order within quiz |
| created_at | timestamptz | | |

### Question validation

- Parent quiz must exist for Lab → else `NOT_FOUND`
- Create MUST include ≥2 inline options with exactly one `isCorrect: true`
- `questionType` other than `single_select` → `VALIDATION_ERROR`
- PATCH: `prompt` and/or `sequenceOrder` only (no option replace payload)
- DELETE question cascades its options

---

## Quiz Option (existing)

Table: `quiz_options`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | |
| question_id | uuid | FK → quiz_questions ON DELETE CASCADE | |
| label | text | NOT NULL | |
| sequence_order | int | NOT NULL | |
| is_correct | boolean | NOT NULL | **Admin-only on read**; never on learner definition |
| created_at | timestamptz | | |

### Option / answer-key invariants

After every successful write, each single-select question MUST have:

1. At least **two** options
2. Exactly **one** option with `is_correct = true`

Enforcement: transactional UseCase validation. When setting `isCorrect: true` on an option, clear siblings’ `isCorrect` in the same transaction.

Reject (no partial persist) when:

- Question create without valid inline options
- Option delete would leave &lt;2 options
- Option create/update/delete would leave 0 or &gt;1 correct flags
- Setting the only correct option to `false`

---

## Quiz Attempt (existing — cascade only)

Table: `quiz_attempts` — learner attempts. Admin does not author attempts. Quiz DELETE cascades attempts away. Lab completion rows elsewhere are **not** deleted.

---

## Admin view shapes (not tables)

| View | Includes |
|------|----------|
| `AdminQuizView` | quiz id, labSlug, title, questions[] with options including `isCorrect`, timestamps |
| `AdminQuizQuestionView` | question fields + options with `isCorrect` |
| `AdminQuizOptionView` | option fields including `isCorrect` |

Learner `QuizDefinitionResponse` / `QuizOptionPublic` remain without `isCorrect` (017).

---

## Reorder

- Questions: client sends complete ordered list of all question ids for the quiz → rewrite `sequence_order` to 1..N transactionally
- Options: complete ordered list of all option ids for the question → rewrite `sequence_order` to 1..M
- Incomplete / duplicate / unknown ids → `VALIDATION_ERROR`; previous order unchanged
