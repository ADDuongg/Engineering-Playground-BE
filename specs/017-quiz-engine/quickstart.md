# Quickstart: Quiz Engine

**Feature**: 017-quiz-engine

## Prerequisites

- Node.js ≥ 22, pnpm ≥ 10
- Platform PostgreSQL running (see `.env`)
- Migrations applied including Progress labs seed **and** Quiz tables/seed
- API base URL: `http://localhost:${PORT}/api/v1`
- A registered user + access token (see Authentication quickstart)

## Setup

```bash
pnpm install
pnpm migration:run
pnpm dev
```

## Validate — Self-complete blocked until quiz pass

```bash
curl -s -X POST http://localhost:${PORT}/api/v1/progress/labs/index-playground/complete \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected**: `403` / `FORBIDDEN` (quiz must be passed). Adjust lab slug if seed uses another gated lab.

## Validate — Fetch quiz definition

```bash
curl -s http://localhost:${PORT}/api/v1/quizzes/labs/index-playground \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected**: `success: true`, `data.questions` length ≥ 1, each option has `id`/`label`/`sequenceOrder`, **no** `isCorrect`.

Capture `questionId` / `optionId` values for submit (use correct options from seed knowledge in tests; do not rely on API for correctness).

## Validate — Submit failing attempt

Submit with at least one wrong option id (from definition options that are incorrect per seed).

```bash
curl -s -X POST http://localhost:${PORT}/api/v1/quizzes/labs/index-playground/submit \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"answers":[/* incomplete or wrong set */]}' | jq .
```

**Expected**: `passed: false`, attempt stored; progress still shows lab not completed.

## Validate — Submit passing attempt

Submit all correct option ids (from seed fixtures in automated tests).

**Expected**: `passed: true`, `labCompleted: true` (or already completed), progress read shows `index-playground` completed; `quiz.completed` emitted (assert in unit/integration).

## Validate — Best score result

After a fail then a pass (or higher percent):

```bash
curl -s http://localhost:${PORT}/api/v1/quizzes/labs/index-playground/result \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected**: `status: "passed"`, `percentCorrect: 100`, `attemptCount` ≥ 2 if both attempts were made.

## Validate — Auth required

```bash
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:${PORT}/api/v1/quizzes/labs/index-playground
```

**Expected**: `401`.

## Validate — Lab without quiz still self-completes

Use a seeded catalog lab that has **no** quiz (if any remain ungated). If all MVP labs gain quizzes later, cover ungated path in unit tests with a lab fixture without quiz row.

## Automated checks

```bash
pnpm test -- quiz
pnpm test:e2e -- quiz-engine
```

(Adjust test path filters to match implemented specs.)
