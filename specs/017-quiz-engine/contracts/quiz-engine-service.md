# API Contract: Quiz Engine

**Feature**: 017-quiz-engine | **Module**: `QuizModule` | **Base path**: `/quizzes`

All JSON responses use the standard API envelope: `{ success, data, meta, error }` unless noted.

Progress self-complete contract change is documented at the end (gating).

---

## GET /quizzes/labs/:labSlug

**Purpose**: Authenticated quiz definition for FE rendering (no correct answers).

**Auth**: JWT required

### Response `200 OK`

```typescript
interface QuizDefinitionResponse {
  labSlug: string;
  trackSlug: string;
  title: string | null;
  questions: QuizQuestionPublic[];
}

interface QuizQuestionPublic {
  id: string; // uuid
  prompt: string;
  sequenceOrder: number;
  questionType: 'single_select';
  options: QuizOptionPublic[];
}

interface QuizOptionPublic {
  id: string; // uuid
  label: string;
  sequenceOrder: number;
  // no isCorrect
}
```

Questions/options sorted by `sequenceOrder` ascending.

### Errors

| ErrorCode | HTTP | When |
|-----------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `NOT_FOUND` | 404 | Unknown lab slug, or lab has no quiz |
| `FORBIDDEN` | 403 | Lab’s Track is not `active` |

---

## POST /quizzes/labs/:labSlug/submit

**Purpose**: Submit answers, grade (100% pass), persist attempt; on pass, record lab completion.

**Auth**: JWT required

### Request body

```typescript
interface SubmitQuizRequest {
  answers: Array<{
    questionId: string; // uuid
    optionId: string; // uuid
  }>;
}
```

### Response `200 OK`

```typescript
interface SubmitQuizResult {
  labSlug: string;
  trackSlug: string;
  correctCount: number;
  totalQuestions: number;
  percentCorrect: number; // 0–100
  passed: boolean;
  attemptedAt: string; // ISO
  incorrectQuestionIds: string[]; // questions answered wrong
  labCompleted: boolean; // true if this submit caused or already had completion after pass
  alreadyLabCompleted: boolean; // true if completion existed before this submit
}
```

### Side effects

- Always insert a new `quiz_attempts` row on valid submit.
- If `passed`:
  - Emit `quiz.completed`.
  - Ensure Progress completion for lab (idempotent); emit `lab.completed` only on first completion insert.
- If not `passed`: no completion write; no `quiz.completed`.

### Errors

| ErrorCode | HTTP | When |
|-----------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `NOT_FOUND` | 404 | Unknown lab or no quiz |
| `FORBIDDEN` | 403 | Track not `active` |
| `VALIDATION_ERROR` | 400 | Incomplete answers, unknown ids, duplicate questionId, option not on question |

---

## GET /quizzes/labs/:labSlug/result

**Purpose**: Current user’s best quiz result for a lab.

**Auth**: JWT required

### Response `200 OK`

```typescript
interface QuizResultSummaryResponse {
  labSlug: string;
  status: 'not_attempted' | 'failed' | 'passed';
  attemptCount: number;
  correctCount?: number;
  totalQuestions?: number;
  percentCorrect?: number;
  bestAttemptedAt?: string; // ISO
}
```

When `status === 'not_attempted'`, score fields are omitted (or null); `attemptCount` is `0`.

### Errors

| ErrorCode | HTTP | When |
|-----------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `NOT_FOUND` | 404 | Unknown lab or no quiz |
| `FORBIDDEN` | 403 | Track not `active` (optional consistency with other quiz routes) |

---

## Domain event: `quiz.completed`

```typescript
export const QUIZ_COMPLETED_EVENT = 'quiz.completed';

export interface QuizCompletedEvent {
  userId: string;
  labSlug: string;
  trackSlug: string;
  correctCount: number;
  totalQuestions: number;
  percentCorrect: number;
  passed: true;
  attemptedAt: string; // ISO
}
```

Emitted in-process via EventEmitter2 after a **passing** attempt is persisted.

---

## Progress contract change: gated self-complete

### POST /progress/labs/:labSlug/complete (existing)

**Additional behavior**:

| ErrorCode | HTTP | When |
|-----------|------|------|
| `FORBIDDEN` | 403 | Lab has a quiz and the user has no passing attempt yet |

Message SHOULD indicate the quiz must be passed before completion.

Labs **without** a quiz: behavior unchanged from 016-progress-tracking.

---

## Out of scope (this contract)

- Admin quiz CRUD
- Multi-select / free-text questions
- Anonymous quizzes
- Attempt limit enforcement
- Public (unauthenticated) quiz definition
