# Research: Quiz Engine

**Feature**: 017-quiz-engine | **Date**: 2026-07-09

## 1. Quiz schema shape

**Decision**: Normalize Platform tables: `quizzes` (1:1 with `labs`), `quiz_questions`, `quiz_options` (with `is_correct` server-only), `quiz_attempts` storing score summary + JSON (or child rows) of selected option ids.

**Rationale**: Spec entities map cleanly; seed/migration authoring is straightforward; definition API can omit `is_correct` at mapper boundary.

**Alternatives considered**:
- Single JSON blob per quiz — harder to query/validate options; weaker integrity
- Embed quiz in `labs` row — couples Progress catalog migration to quiz content churn

## 2. Pass rule and grading

**Decision**: Grade per question: selected option id must equal the single correct option; pass iff correctCount === totalQuestions (100%). Percent = round(correctCount / total * 100).

**Rationale**: Clarification A; simplest gate for short learning quizzes.

**Alternatives considered**: Configurable threshold — deferred; majority pass — too weak for one-concept labs

## 3. Retakes and best score

**Decision**: Insert a new `quiz_attempts` row on every valid submit. Result API computes best: max `percentCorrect`; `passed` if any attempt has `passed = true`. On percent ties, prefer most recent `attempted_at`.

**Rationale**: Clarification A; learning-first unlimited practice; SC-007.

**Alternatives considered**: Latest-only — loses improvement signal; attempt caps — unnecessary friction for MVP

## 4. Question type MVP

**Decision**: Persist `question_type = 'single_select'` only; submit body is `{ answers: [{ questionId, optionId }] }` with exactly one option per question; reject duplicates/missing/unknown ids.

**Rationale**: Clarification A; true/false can be two-option single-select later without a new type.

**Alternatives considered**: Multi-select — deferred; free-text — out of scope

## 5. Quiz-gating rule

**Decision**: Presence of a `quizzes` row for a lab ⇒ gated. `CompleteLabUseCase` checks quiz existence + whether user has any passing attempt; if quiz exists and no pass → `FORBIDDEN` with message that quiz must be passed. Labs without quiz unchanged.

**Rationale**: Spec clarification; avoids a separate `quiz_gated` flag.

**Alternatives considered**: Explicit flag on lab — extra seed field with no MVP benefit; soft-gate (warn only) — violates FR-009

## 6. Completion on pass

**Decision**: `SubmitQuizUseCase` on first pass (or any pass when not yet completed) invokes Progress completion persistence (exported `CompleteLabUseCase` with an internal/trusted path **or** shared `recordLabCompletion` helper that skips the quiz gate). Prefer: extract `RecordLabCompletionService` used by both self-complete (after gate) and quiz submit (after pass), so quiz submit does not re-enter the gated self-complete path.

**Rationale**: Avoid deadlock (submit → complete → quiz check → fail). Single registry shape preserved. Emit `lab.completed` only on first completion insert (existing Progress behavior). Always emit `quiz.completed` on a **passing** attempt (even if lab already completed); do not emit `quiz.completed` on failing attempts.

**Alternatives considered**:
- Submit calls public complete endpoint — re-triggers gate
- Duplicate completion table in Quiz — forbidden by Progress ownership
- Emit only `quiz.completed` and let a listener complete — extra indirection for MVP; acceptable later

## 7. Definition vs result feedback

**Decision**: Definition API returns questions/options without correctness. Submit response includes score summary plus optional `incorrectQuestionIds` (or per-question correct boolean) for learning feedback — **not** the full answer key of correct option ids on fail. Result API returns best summary only (no per-question breakdown required for MVP).

**Rationale**: Spec assumption; SC-002; reduces answer-key dumping while still teaching.

**Alternatives considered**: Full key on every fail — hurts integrity of retakes; no feedback — weaker learning UX

## 8. Module and auth

**Decision**: New `src/modules/quiz/` with JWT on all routes. Seed quiz for `index-playground` in a new migration after labs exist.

**Rationale**: Feature-first; Progress already seeded that lab; enables gating tests immediately.

**Alternatives considered**: Stuff into Progress module — mixes catalog/completion with assessment; bloated module

## 9. Events

**Decision**: `QUIZ_COMPLETED_EVENT = 'quiz.completed'` payload: `userId`, `labSlug`, `trackSlug`, `percentCorrect`, `correctCount`, `totalQuestions`, `passed: true`, `attemptedAt`. Emit only when `passed`.

**Rationale**: SYSTEM_DESIGN §20 `QuizCompleted`; mirrors `lab.completed` pattern.

## 10. Playground reset isolation

**Decision**: No playground FK/writes; integration assertion that attempts + quiz definitions survive dataset reset.

**Rationale**: Constitution platform vs runtime separation.
