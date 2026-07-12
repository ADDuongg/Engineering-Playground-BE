# API Contract: Admin AuthZ

**Feature**: admin-authz | **Base path**: `/api/v1/admin` | **Auth scheme**: JWT Bearer (access token)

All responses use the standard envelope.

```json
{
  "success": true,
  "data": {},
  "meta": { "timestamp": "ISO-8601", "requestId": "uuid" },
  "error": null
}
```

---

## Authorization model

| Caller | Admin-namespace outcome |
|--------|-------------------------|
| No / invalid Bearer token | `401` `UNAUTHORIZED` |
| Valid token, `role: user` | `403` `FORBIDDEN` |
| Valid token, `role: admin` | Allowed; handler runs |
| Valid token, missing/unknown role | `403` `FORBIDDEN` |

- Role is taken from the **access token** (`JwtPayload.role`), not re-read from Platform DB per request.
- Learner routes (e.g. `/api/v1/auth/*`, labs, experiments) MUST NOT gain admin mutations via this feature.
- Future admin controllers under `/api/v1/admin/*` MUST use the same `@Roles(Role.ADMIN)` + global `RolesGuard` pattern.

### Shared types (reuse)

```typescript
type Role = 'user' | 'admin';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string; // ISO-8601
}
```

Exported from `@db-play/types` (existing Authentication contracts).

---

## GET /api/v1/admin/me

Read-only admin whoami / session probe.

**Auth**: Bearer required + `role: admin`

**Success** `200`:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@example.com",
    "displayName": "Dev Admin",
    "role": "admin",
    "createdAt": "2026-07-12T00:00:00.000Z"
  },
  "meta": { "requestId": "...", "timestamp": "..." },
  "error": null
}
```

**Errors**:

| Status | Code | When |
|--------|------|------|
| 401 | `UNAUTHORIZED` | Missing/invalid access token |
| 403 | `FORBIDDEN` | Authenticated but not admin |

**Forbidden example**:

```json
{
  "success": false,
  "data": null,
  "meta": { "requestId": "...", "timestamp": "..." },
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin role required",
    "details": null
  }
}
```

Message text may be refined in implementation but MUST remain clear and MUST NOT leak other users' data.

---

## FE / operator integration checklist

1. Promote a local user to admin (see [quickstart.md](../quickstart.md)), then login/refresh.
2. Call `GET /api/v1/admin/me` with `Authorization: Bearer <accessToken>`.
3. On `403`, treat as insufficient role (do not retry as if auth expired unless also getting `401`).
4. On `401`, refresh via `/auth/refresh` then retry once; if still `401`, re-login.
5. Do not call admin APIs with learner-only tokens expecting success.

---

## Out of scope (later features)

- `POST/PATCH/DELETE` under `/admin/tracks`, `/admin/labs`, quizzes, users
- Auto-seed admin accounts
- Separate admin login or MFA
