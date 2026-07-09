# Quickstart: Per-User Rate Limit

## Verify unit tests

```bash
pnpm test -- rate-limit.service.spec
```

## Verify integration (requires Redis + DB)

```bash
pnpm test -- rate-limit.integration-spec
```

## Manual check

1. Set low limits: `RATE_LIMIT_SQL_RUN=2`
2. Start API: `pnpm dev`
3. Run 3 SQL experiment requests with same user/session
4. Third request returns 429 with `RATE_LIMITED` and `retryAfterSeconds`

## Config reference

| Env | Default |
| --- | ------- |
| RATE_LIMIT_WINDOW_SECONDS | 60 |
| RATE_LIMIT_SQL_RUN | 30 |
| RATE_LIMIT_EXPLAIN_RUN | 10 |
| RATE_LIMIT_DATASET_RESET | 5 |
| RATE_LIMIT_BENCHMARK_ENQUEUE | 5 |
| RATE_LIMIT_ELEVATED_ENABLED | false |
| RATE_LIMIT_ELEVATED_USER_IDS | (empty) |
| RATE_LIMIT_ELEVATED_MULTIPLIER | 5 |
