# Quickstart: SQL Sandbox & Resource Limits

**Feature**: 002-sql-sandbox | **Date**: 2026-07-08

Validate the sandbox module after implementation. Prerequisites: Platform and Playground PostgreSQL running (see project `.env`).

## 1. Environment

Optional overrides in `.env`:

```env
SANDBOX_QUERY_TIMEOUT_MS=30000
SANDBOX_MAX_ROWS=10000
SANDBOX_POLICY_VERSION=1
```

## 2. Run unit tests

```bash
pnpm test -- sql-sandbox
```

**Expected**: All validator, classifier, and use case unit tests pass.

## 3. Run integration tests

Requires playground DB reachable on configured host/port (default `localhost:5433`).

```bash
pnpm test:e2e -- sql-sandbox
```

**Expected**:
- Allowed `SELECT $1` executes successfully
- `DROP DATABASE` rejected with `SANDBOX_ERROR` before execution
- Slow query fixture hits `TIMEOUT` within configured bound

## 4. Manual smoke test (NestJS REPL or temporary script)

After module is wired, invoke `ExecuteSandboxedSqlUseCase` with:

| Input | Expected |
| ----- | -------- |
| `SELECT 1 AS n` + `[]` | Success, 1 row |
| `SELECT pg_sleep(60)` + `[]` with 5s timeout env | `TIMEOUT` error with hint |
| `COPY (SELECT 1) TO PROGRAM 'id'` + `[]` | `SANDBOX_ERROR` blocked pattern |
| Empty string | `VALIDATION_ERROR` |

## 5. Verify platform separation

Confirm sandbox module imports only `PlaygroundDatabaseModule`, not `PlatformDatabaseModule`.

## 6. Definition of done checklist

- [ ] Unit tests pass
- [ ] Integration tests pass against playground DB
- [ ] Dangerous statement fixtures blocked (spec SC-001)
- [ ] Timeout terminates within 5s of limit (spec SC-004)
- [ ] Shared types exported from `@db-play/types`
- [ ] No HTTP endpoints added (internal module only)

See [sandbox-service.md](./contracts/sandbox-service.md) for full contract details.
