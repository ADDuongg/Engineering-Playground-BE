# Quickstart: Quiz Admin CRUD

Validate admin quiz authoring, answer-key rules, learner definition hiding correct answers, and delete/gating behavior. Full contract: [contracts/quiz-admin-api.md](./contracts/quiz-admin-api.md). Data model: [data-model.md](./data-model.md).

## Prerequisites

- Platform DB migrated (`pnpm migration:run`)
- API running (`pnpm dev`)
- Admin token (seeded `admin@playground.local` / `Password123!`)
- Learner token (seeded `user@playground.local` / `Password123!`)
- An existing Lab slug (e.g. `index-playground`, or a lab created via Track & Lab Admin)

## 1. Admin get existing Index Playground quiz

```bash
curl -s http://localhost:3001/api/v1/admin/labs/index-playground/quiz \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expect `200` with questions/options including `isCorrect`.

## 2. Learner definition hides correct answers

```bash
curl -s http://localhost:3001/api/v1/quizzes/labs/index-playground \
  -H "Authorization: Bearer $USER_TOKEN"
```

Expect `200`. Options must **not** include `isCorrect` (or any scoring key).

## 3. Create quiz on a lab without one (optional)

If using a lab without a quiz:

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/labs/$LAB_SLUG/quiz \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Smoke Quiz" }'
```

Expect `201`. Learner self-complete for that lab should now be blocked (quiz-gated). Duplicate POST → `409`.

## 4. Create a question with inline options

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/labs/$LAB_SLUG/quiz/questions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What does an index help with?",
    "sequenceOrder": 1,
    "options": [
      { "label": "Faster lookups", "sequenceOrder": 1, "isCorrect": true },
      { "label": "Slower writes only", "sequenceOrder": 2, "isCorrect": false }
    ]
  }'
```

Expect `201` with both options and exactly one `isCorrect: true`.

## 5. Reject invalid answer key

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/labs/$LAB_SLUG/quiz/questions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Bad question",
    "sequenceOrder": 2,
    "options": [
      { "label": "A", "sequenceOrder": 1, "isCorrect": true },
      { "label": "B", "sequenceOrder": 2, "isCorrect": true }
    ]
  }'
```

Expect `400` validation error; no question persisted.

## 6. Reorder questions

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/labs/$LAB_SLUG/quiz/questions/reorder \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"questionIds\": $REORDERED_QUESTION_IDS_JSON}"
```

`$REORDERED_QUESTION_IDS_JSON` must list **all** question ids. Expect `200`; learner definition order matches.

## 7. Non-admin forbidden

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/labs/$LAB_SLUG/quiz \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Nope" }'
```

Expect `403`.

## 8. Delete quiz (careful on shared labs)

Prefer a disposable lab for this step:

```bash
curl -s -X DELETE http://localhost:3001/api/v1/admin/labs/$LAB_SLUG/quiz \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expect success. Learner `GET /quizzes/labs/$LAB_SLUG` → `404`. Self-complete allowed again. Existing lab completion records (if any) remain.

## Automated checks

```bash
pnpm test -- quiz-admin
pnpm test:e2e -- quiz-admin.integration-spec
```
