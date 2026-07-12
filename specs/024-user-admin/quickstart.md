# Quickstart: User Admin

Validate admin user list/search/get and role promote/demote with last-admin guardrail. Full contract: [contracts/user-admin-api.md](./contracts/user-admin-api.md). Data model: [data-model.md](./data-model.md).

## Prerequisites

- Platform DB migrated (`pnpm migration:run`) — includes `updated_by` on `users` and seeded `admin@playground.local` / `user@playground.local`
- API running (`pnpm dev`)

## 1. Login as admin

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@playground.local","password":"Password123!"}'
```

Set `ADMIN_TOKEN` from `data.accessToken`.

## 2. List users

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/v1/admin/users?page=1&limit=20"
```

Expect `200`, `data` array of users (no password fields), `meta.pagination.total` ≥ 2, ordered oldest-first.

## 3. Search

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/v1/admin/users?q=user@playground"
```

Expect the seeded learner in results.

## 4. Get by id

Use an `id` from the list response:

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/v1/admin/users/$USER_ID"
```

Expect `200` with matching `AdminUserView`.

## 5. Promote learner → admin

```bash
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}' \
  "http://localhost:3001/api/v1/admin/users/$USER_ID"
```

Expect `200`, `data.role === "admin"`, `data.updatedBy` equals the acting admin’s id.

Have that user **refresh or re-login** before admin routes work for them (no forced logout/revoke on change).

## 6. Demote back (with ≥2 admins)

```bash
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"user"}' \
  "http://localhost:3001/api/v1/admin/users/$USER_ID"
```

Expect `200`, `data.role === "user"`.

## 7. Last-admin guardrail

With only one admin remaining, attempt to demote that admin (self or sole admin id):

```bash
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"user"}' \
  "http://localhost:3001/api/v1/admin/users/$SOLE_ADMIN_ID"
```

Expect `409` with `error.code === "CONFLICT"`.

## 8. Non-admin denied

Login as `user@playground.local`, then:

```bash
curl -s -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3001/api/v1/admin/users
```

Expect `403 FORBIDDEN`.

## Automated checks

```bash
pnpm test -- user-admin
pnpm test:e2e -- user-admin.integration-spec
```
