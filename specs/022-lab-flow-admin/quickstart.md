# Quickstart: Lab Flow Admin

Validate admin lab-flow writes, Index Playground seed, and learner summary hard cutover. Full contract: [contracts/lab-flow-admin-api.md](./contracts/lab-flow-admin-api.md). Data model: [data-model.md](./data-model.md).

## Prerequisites

- Platform DB migrated (`pnpm migration:run`) — includes lab flow tables + Index Playground seed
- API running (`pnpm dev`)
- Admin token (seeded `admin@playground.local` / `Password123!`)
- Learner token (seeded `user@playground.local` / `Password123!`)

## 1. Confirm Index Playground summary from DB

```bash
curl -s http://localhost:3001/api/v1/labs/index-playground/summary \
  -H "Authorization: Bearer $USER_TOKEN"
```

Expect `200`, non-empty `guidedSteps`, `learningGoal` present. SQL/explain/create/drop steps include `payload` (e.g. `recommendedQuery` or `sql`). Top-level `recommendedQuery` / create / drop fields remain for compatibility (derived from steps).

## 2. Admin list steps

```bash
curl -s http://localhost:3001/api/v1/admin/labs/index-playground/steps \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expect `200` with ordered steps matching summary count.

## 3. Patch a step instruction

Pick a `stepId` from step 2:

```bash
curl -s -X PATCH http://localhost:3001/api/v1/admin/labs/index-playground/steps/$STEP_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Updated instruction for smoke test",
    "payload": {
      "recommendedQuery": {
        "sql": "SELECT id, email, name FROM users WHERE email = $1",
        "exampleParameters": ["user1@example.com"],
        "paramHints": ["pass email"],
        "description": "lookup"
      }
    }
  }'
```

Re-fetch learner summary; expect updated instruction and step `payload.recommendedQuery` without redeploy.

## 4. Reorder steps

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/labs/index-playground/steps/reorder \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"stepIds\": $REORDERED_IDS_JSON}"
```

`$REORDERED_IDS_JSON` must be a JSON array of **all** existing step ids in the new order. Expect `200`; learner summary `guidedSteps` order matches.

## 5. Curriculum partial update + null clear

```bash
curl -s -X PATCH http://localhost:3001/api/v1/admin/labs/index-playground/curriculum \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "optionalBenchmarkNote": null }'
```

Expect `200`, `optionalBenchmarkNote === null`. Omitted fields unchanged.

## 6. Non-admin forbidden

```bash
curl -s -X POST http://localhost:3001/api/v1/admin/labs/index-playground/steps \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nope",
    "instruction": "Should fail",
    "action": "run_sql",
    "displayOrder": 99
  }'
```

Expect `403`.

## 7. Seed skip (optional)

Re-run migrations / seed path in a DB that already has Index Playground curriculum. Expect no duplicate steps and no overwrite of the patched instruction from step 3.

## Automated check

```bash
pnpm test:e2e -- lab-flow-admin.integration-spec
```
