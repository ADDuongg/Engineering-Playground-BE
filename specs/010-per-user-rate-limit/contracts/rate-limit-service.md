# Contract: Rate Limit Service

Internal service consumed by experiment runners and dataset reset — no public HTTP API.

## consumeQuota

**Input**

```typescript
{
  operation: RateLimitOperation;
  userId?: string;
  sessionId?: string;
}
```

**Success**: void — quota consumed atomically.

**Failure — limit exceeded** (HTTP 429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Fair-use limit reached for SQL runs. Try again in 42 seconds.",
    "details": {
      "reason": "RATE_LIMIT_EXCEEDED",
      "operation": "sql_run",
      "operationLabel": "SQL run",
      "retryAfterSeconds": 42,
      "hint": "Experiment operations are limited per learner so everyone can use the playground fairly."
    }
  }
}
```

**Failure — Redis unavailable** (HTTP 503)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Rate limiting is temporarily unavailable. Try again shortly.",
    "details": { "reason": "RATE_LIMIT_STORAGE_UNAVAILABLE" }
  }
}
```

## Identity resolution

1. If `userId` present → key as `user:{userId}`
2. Else if `sessionId` present → key as `session:{sessionId}`
3. Else → 400 validation error (`RATE_LIMIT_IDENTITY_REQUIRED`)

## Default limits (configurable)

| Operation | Default limit / 60s window |
| --------- | -------------------------- |
| sql_run | 30 |
| explain_run | 10 |
| dataset_reset | 5 |
| benchmark_enqueue | 5 |
