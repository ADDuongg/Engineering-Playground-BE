# Quickstart: Authentication

## Prerequisites

- Platform PostgreSQL running with migrations applied (`pnpm migration:run`)
- `.env` with `PLATFORM_DB_*`, `JWT_SECRET` (≥32 chars)

## Run API

```bash
pnpm dev
```

Swagger: `http://localhost:3001/api/docs` (tag: `auth`)

## Manual validation

### Register

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"learner@example.com","password":"password123","displayName":"Learner"}' | jq
```

Expect `201`, envelope with `user` and `tokens`.

### Login

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"learner@example.com","password":"password123"}' | jq
```

### Profile

```bash
curl -s http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>" | jq
```

### Refresh

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}' | jq
```

### Logout

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3001/api/v1/auth/logout \
  -H "Authorization: Bearer <accessToken>" \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

Expect `204`.

## Automated tests

```bash
# Unit tests
pnpm test -- --testPathPattern=auth

# Integration (requires Platform DB)
pnpm test:e2e -- --testPathPattern=auth.integration
```

See [contracts/auth-api.md](./contracts/auth-api.md) for full contract and integration test requirements.
