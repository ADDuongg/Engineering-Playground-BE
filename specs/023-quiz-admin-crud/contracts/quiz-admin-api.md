# API Contract: Quiz Admin CRUD

**Feature**: quiz-admin-crud | **Base path**: `/api/v1/admin` | **Auth scheme**: JWT Bearer + `role: admin`

All responses use the standard envelope (`success`, `data`, `meta`, `error`).

Learner quiz APIs remain under `/api/v1/quizzes/...` (017) — definition never includes `isCorrect`.

---

## Authorization

Same as [Admin AuthZ](../../020-admin-authz/contracts/admin-authz-api.md):

| Caller | Outcome |
|--------|---------|
| No / invalid token | `401 UNAUTHORIZED` |
| `role: user` | `403 FORBIDDEN` |
| `role: admin` | Allowed |

---

## Shared types (`@db-play/types`)

```typescript
type QuizQuestionType = 'single_select';

interface AdminQuizOptionView {
  id: string;
  label: string;
  sequenceOrder: number;
  isCorrect: boolean;
  createdAt: string;
}

interface AdminQuizQuestionView {
  id: string;
  prompt: string;
  questionType: QuizQuestionType;
  sequenceOrder: number;
  options: AdminQuizOptionView[];
  createdAt: string;
}

interface AdminQuizView {
  id: string;
  labSlug: string;
  title: string | null;
  questions: AdminQuizQuestionView[];
  createdAt: string;
  updatedAt: string;
}

interface CreateLabQuizRequest {
  title?: string | null;
}

interface UpdateLabQuizRequest {
  title?: string | null; // null clears title
}

interface CreateQuizOptionInline {
  label: string;
  sequenceOrder: number;
  isCorrect: boolean;
}

interface CreateQuizQuestionRequest {
  prompt: string;
  sequenceOrder: number;
  questionType?: QuizQuestionType; // default single_select
  options: CreateQuizOptionInline[]; // ≥2, exactly one isCorrect
}

interface UpdateQuizQuestionRequest {
  prompt?: string;
  sequenceOrder?: number;
}

interface CreateQuizOptionRequest {
  label: string;
  sequenceOrder: number;
  isCorrect: boolean;
}

interface UpdateQuizOptionRequest {
  label?: string;
  sequenceOrder?: number;
  isCorrect?: boolean;
}

interface ReorderQuizQuestionsRequest {
  /** Complete ordered list of all question ids for the quiz */
  questionIds: string[];
}

interface ReorderQuizOptionsRequest {
  /** Complete ordered list of all option ids for the question */
  optionIds: string[];
}
```

---

## Quiz shell

### GET `/admin/labs/:labSlug/quiz`

**200** → `AdminQuizView`  
**404** → lab or quiz missing

### POST `/admin/labs/:labSlug/quiz`

Body: `CreateLabQuizRequest`  
**201** → `AdminQuizView` (questions may be `[]`)  
**404** → lab missing  
**409** → quiz already exists  

Side effect: Lab becomes quiz-gated immediately.

### PATCH `/admin/labs/:labSlug/quiz`

Body: `UpdateLabQuizRequest`  
**200** → `AdminQuizView`  
**404** → lab or quiz missing

### DELETE `/admin/labs/:labSlug/quiz`

**204** (or **200** with empty data — match existing admin delete style)  
**404** → lab or quiz missing  

Side effects: hard-delete quiz + cascade questions/options/attempts; lab completions unchanged; Lab no longer quiz-gated.

---

## Questions

### POST `/admin/labs/:labSlug/quiz/questions`

Body: `CreateQuizQuestionRequest`  
**201** → `AdminQuizQuestionView`  
**404** → lab or quiz missing  
**400** → invalid options / type / answer key

### PATCH `/admin/labs/:labSlug/quiz/questions/:questionId`

Body: `UpdateQuizQuestionRequest` (prompt/order only)  
**200** → `AdminQuizQuestionView`  
**404** → missing / wrong lab

### DELETE `/admin/labs/:labSlug/quiz/questions/:questionId`

**204** / **200**  
**404** → missing / wrong lab

### POST `/admin/labs/:labSlug/quiz/questions/reorder`

Body: `ReorderQuizQuestionsRequest`  
**200** → `{ questions: AdminQuizQuestionView[] }`  
**400** → incomplete/duplicate/unknown ids  
**404** → lab or quiz missing

---

## Options

### POST `/admin/labs/:labSlug/quiz/questions/:questionId/options`

Body: `CreateQuizOptionRequest`  
**201** → `AdminQuizOptionView`  
**400** → would violate ≥2 / exactly-one-correct (after write)  
**404** → missing question/lab/quiz

If `isCorrect: true`, clear sibling correct flags in the same transaction.

### PATCH `/admin/labs/:labSlug/quiz/questions/:questionId/options/:optionId`

Body: `UpdateQuizOptionRequest`  
**200** → `AdminQuizOptionView`  
**400** → answer-key violation  
**404** → missing

### DELETE `/admin/labs/:labSlug/quiz/questions/:questionId/options/:optionId`

**204** / **200**  
**400** → would leave &lt;2 options or not exactly one correct  
**404** → missing

### POST `/admin/labs/:labSlug/quiz/questions/:questionId/options/reorder`

Body: `ReorderQuizOptionsRequest`  
**200** → `{ options: AdminQuizOptionView[] }`  
**400** → incomplete/duplicate/unknown ids  
**404** → missing

---

## Learner surfaces (unchanged contract)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/quizzes/labs/:labSlug` | No `isCorrect`; empty questions allowed if shell exists |
| POST | `/quizzes/labs/:labSlug/submit` | Reject empty quiz / incomplete answers |
| GET | `/quizzes/labs/:labSlug/result` | Unchanged |

Progress self-complete remains blocked while quiz row exists; allowed again after quiz DELETE.

---

## Error codes (summary)

| ErrorCode | HTTP | When |
|-----------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `FORBIDDEN` | 403 | Non-admin on admin routes |
| `NOT_FOUND` | 404 | Unknown lab/quiz/question/option |
| `CONFLICT` | 409 | Second quiz create for same lab |
| `VALIDATION_ERROR` | 400 | Answer-key / reorder / type / empty submit |
