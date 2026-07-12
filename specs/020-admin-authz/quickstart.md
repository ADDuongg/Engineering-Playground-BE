# Quickstart: Admin AuthZ

Validate admin-only access and the read-only whoami probe. Full contract: [contracts/admin-authz-api.md](./contracts/admin-authz-api.md).

## Prerequisites

- Platform DB migrated (`pnpm migration:run`) — seeds `admin@playground.local` and `user@playground.local`
- API running (`pnpm dev`)

## 0. Seeded accounts (preferred for local/dev)

Migration `1730600000000-SeedDevUsers` inserts:

| Email | Password | Role |
|-------|----------|------|
| `admin@playground.local` | `Password123!` | admin |
| `user@playground.local` | `Password123!` | user |

Login via `POST /api/v1/auth/login`, then call `GET /api/v1/admin/me` with the admin token.

## 1. Promote another user to admin (optional)

No need if you use the seeded admin. To promote a custom account, update Platform DB manually.

Default local Platform DB (from `.env.example`): host `localhost`, port `5434`, db `platform_db`, user `platform`.

```bash
# Example with docker exec (compose service: postgres_platform)
docker exec -it dbplay_postgres_platform \
  psql -U platform -d platform_db \
  -c "UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';"
```

Or with `psql` against localhost:

```sql
UPDATE users
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

Verify:

```sql
SELECT id, email, role FROM users WHERE email = 'your-email@example.com';
-- expect role = 'admin'
```

Then **sign in again** or call `POST /api/v1/auth/refresh` so the access token carries `role: admin`.

> Canonical promotion procedure for onboarding. README links here.

## 2. Verify admin whoami succeeds

```bash
# After login as the promoted user, set ACCESS_TOKEN
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:3001/api/v1/admin/me
```

Expect `200` with `data.role === "admin"` and profile fields populated.

## 3. Verify non-admin is forbidden

Register/login as a normal user (role `user`), then:

```bash
curl -s -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  http://localhost:3001/api/v1/admin/me
```

Expect `403` with `error.code === "FORBIDDEN"`.

## 4. Verify unauthenticated is unauthorized

```bash
curl -s http://localhost:3001/api/v1/admin/me
```

Expect `401` with `error.code === "UNAUTHORIZED"`.

## 5. Automated tests

```bash
pnpm test -- roles.guard.spec
pnpm test -- get-admin-me.usecase.spec
pnpm test:e2e -- admin-authz.integration-spec
```

## Learner route smoke

Confirm `GET /api/v1/auth/me` still works for a standard `user` role (no admin requirement on learner routes).
