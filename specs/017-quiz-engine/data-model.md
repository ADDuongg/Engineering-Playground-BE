# Data Model: Quiz Engine

## Quiz (Platform DB)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| lab_id | uuid | FK → labs.id, UNIQUE, ON DELETE CASCADE |
| title | varchar(200) | optional, nullable |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto |

**Indexes**: unique `lab_id`.

**Rule**: Existence of this row for a lab means the lab is quiz-gated.

## QuizQuestion (Platform DB)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| quiz_id | uuid | FK → quizzes.id, ON DELETE CASCADE |
| prompt | text | required |
| question_type | varchar(32) | required; MVP value `single_select` only |
| sequence_order | int | required; order within quiz |
| created_at | timestamptz | auto |

**Indexes**: `(quiz_id, sequence_order)`.

## QuizOption (Platform DB)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| question_id | uuid | FK → quiz_questions.id, ON DELETE CASCADE |
| label | text | required |
| sequence_order | int | required |
| is_correct | boolean | required; **server-only** (never in definition API) |
| created_at | timestamptz | auto |

**Indexes**: `(question_id, sequence_order)`.

**Validation**: Exactly one `is_correct = true` per question (enforced in seed + grading assumptions; DB partial unique optional).

## QuizAttempt (Platform DB)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → users.id, ON DELETE CASCADE |
| quiz_id | uuid | FK → quizzes.id, ON DELETE CASCADE |
| correct_count | int | required ≥ 0 |
| total_questions | int | required > 0 |
| percent_correct | int | required 0–100 |
| passed | boolean | required; true iff percent_correct === 100 |
| answers_json | jsonb | required; snapshot of `{ questionId, optionId }[]` |
| attempted_at | timestamptz | required |
| created_at | timestamptz | auto |

**Indexes**: `(user_id, quiz_id, attempted_at DESC)` for best/latest reads.

No unique constraint on `(user_id, quiz_id)` — unlimited attempts.

## Derived: QuizResultSummary (API view, not a table)

| Field | Meaning |
|-------|---------|
| labSlug | Lab slug |
| status | `not_attempted` \| `failed` \| `passed` |
| correctCount | From best attempt (omit if not_attempted) |
| totalQuestions | From best attempt |
| percentCorrect | Best percent |
| passed | true if any attempt passed |
| bestAttemptedAt | attempted_at of chosen best attempt |
| attemptCount | Number of attempts |

**Best attempt selection**: highest `percent_correct`; ties → most recent `attempted_at`.

## Seed (MVP)

| Lab slug | Quiz title | Questions (illustrative) |
|----------|------------|--------------------------|
| index-playground | Index Playground Quiz | ≥2 single-select questions with one correct option each |

## State transitions

```text
QuizAttempt: (none)
    → recorded fail (passed=false)
    → recorded pass (passed=true) → may trigger lab completion (idempotent)

UserLabCompletion (Progress): unchanged shape
    → created on first passing quiz for gated labs
    → self-complete blocked while quiz exists and no pass
```

## Validation rules

- `labSlug`: must exist; Track must be `active` for fetch/submit (same startability as Progress complete)
- Submit: one answer per question; all questions answered; option belongs to question
- Definition/result/submit: authenticated user only
- Lab with no quiz: definition/submit → not-found (quiz); self-complete still allowed
