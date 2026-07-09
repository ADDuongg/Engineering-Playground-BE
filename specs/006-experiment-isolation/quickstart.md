# Quickstart: Experiment Isolation

**Feature**: 006-experiment-isolation

## Prerequisites

- Platform running with Playground PostgreSQL and Redis
- Dataset Loader and Experiment Runner modules registered
- Commerce dataset manifest available (`commerce` / `100k` / `v1`)

## 1. Provision an experiment session

```bash
curl -s -X POST http://localhost:3000/experiments/sessions \
  -H 'Content-Type: application/json' \
  -H 'X-Session-Token: demo-client-abc' \
  -d '{
    "clientSessionToken": "demo-client-abc",
    "trackSlug": "database-sql",
    "labSlug": "index-playground",
    "dataset": { "family": "commerce", "tier": "100k" }
  }' | jq .
```

Save `data.sessionId` from the response.

## 2. Prepare dataset in session scope

```bash
SESSION_ID="<sessionId from step 1>"

curl -s -X POST http://localhost:3000/datasets/prepare \
  -H 'Content-Type: application/json' \
  -d "{
    \"family\": \"commerce\",
    \"tier\": \"100k\",
    \"sessionId\": \"$SESSION_ID\"
  }" | jq .
```

Poll metadata until `status` is `ready`:

```bash
curl -s "http://localhost:3000/datasets/metadata?family=commerce&tier=100k&sessionId=$SESSION_ID" | jq .
```

## 3. Run SQL in isolated session

```bash
curl -s -X POST http://localhost:3000/experiments/sql/run \
  -H 'Content-Type: application/json' \
  -d "{
    \"sql\": \"SELECT COUNT(*) AS cnt FROM users\",
    \"parameters\": [],
    \"sessionId\": \"$SESSION_ID\",
    \"dataset\": { \"family\": \"commerce\", \"tier\": \"100k\" },
    \"context\": { \"trackSlug\": \"database-sql\", \"labSlug\": \"index-playground\" }
  }" | jq .
```

## 4. Verify cross-session isolation

Provision a second session with a different `clientSessionToken`, prepare the same dataset, and confirm session A mutations (e.g. `INSERT`) are not visible in session B.

## 5. Tear down session

```bash
curl -s -X DELETE "http://localhost:3000/experiments/sessions/$SESSION_ID" | jq .
```

## 6. Run integration tests

```bash
pnpm test:integration -- --testPathPattern=experiment-isolation
```

## Expected outcomes

- Two concurrent sessions return different `schemaName` values
- Platform DB row counts unchanged after provision, SQL, and teardown
- Reusing the same `clientSessionToken` + lab returns `reused: true` when session is still active
