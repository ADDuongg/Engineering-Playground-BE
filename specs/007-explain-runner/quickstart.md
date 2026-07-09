# Quickstart: Explain Runner

## Prerequisites

- Playground PostgreSQL, Redis, Platform DB configured (see experiment-runner quickstart)
- Commerce dataset seeds available

## Validate

```bash
pnpm test -- explain-plan.parser.spec
pnpm test -- run-explain.usecase.spec
pnpm test:integration -- explain-runner.integration-spec
```

## Manual flow

1. `POST /datasets/prepare` — commerce / 100k / v1
2. `POST /experiments/sql/explain` with:

```json
{
  "sql": "SELECT count(*) FROM users",
  "parameters": [],
  "explainMode": "explain",
  "dataset": { "family": "commerce", "tier": "100k", "version": "v1" }
}
```

3. Expect structured `plan.nodeType`, `plan.totalCost`, and nested `children`.

4. Repeat with `"explainMode": "explain_analyze"` — expect `planningTimeMs` and `actualRows` on scan nodes.
