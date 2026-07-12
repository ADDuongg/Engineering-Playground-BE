# API Contract: User Admin

**Feature**: user-admin | **Base path**: `/api/v1/admin/users` | **Auth scheme**: JWT Bearer + `role: admin`

All responses use the standard envelope (`success`, `data`, `meta`, `error`).

Learner routes under `/api/v1/auth/*` remain unchanged — no user directory or role mutation there.

---

## Authorization

Same as [Admin AuthZ](../../020-admin-authz/contracts/admin-authz-api.md):

| Caller | Outcome |
|--------|---------|
| No / invalid token | `401 UNAUTHORIZED` |
| `role: user` | `403 FORBIDDEN` |
| `role: admin` | Allowed |

---

## Shared types (`@db-play/types`)

```typescript
interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  updatedBy: string | null;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

interface UpdateAdminUserRoleRequest {
  role: 'user' | 'admin';
}

interface AdminUserListQuery {
  page?: number; // default 1, min 1
  limit?: number; // default 20, min 1, max 100
  q?: string; // optional search (email OR displayName, case-insensitive substring)
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}
```

---

## Endpoints

### `GET /api/v1/admin/users`

List users with optional search.

**Query**: `AdminUserListQuery`

**Success `200`**:

```json
{
  "success": true,
  "data": [ /* AdminUserView[] */ ],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 42 }
  },
  "error": null
}
```

**Ordering**: `createdAt` ascending, then `id` ascending (fixed; not client-controlled).

**Notes**:

- Empty result → `200` with `data: []` and `total: 0`
- Never includes password hashes or refresh tokens

---

### `GET /api/v1/admin/users/:userId`

Get one user by id.

**Success `200`**: `data` is `AdminUserView`

**Errors**:

| Condition | HTTP | code |
|-----------|------|------|
| Unknown id | 404 | `NOT_FOUND` |

---

### `PATCH /api/v1/admin/users/:userId`

Update user role.

**Body**: `UpdateAdminUserRoleRequest` (required `role`)

**Success `200`**: `data` is `AdminUserView` (after change, or unchanged for same-role no-op)

**Behavior**:

| Case | Result |
|------|--------|
| Role actually changes | Persist new role; set `updatedBy` to acting admin id; bump `updatedAt` |
| Requested role equals current | Success no-op; `updatedBy`/`updatedAt` unchanged |
| Demotion would leave zero admins | `409 CONFLICT` — no write |
| Concurrent demotions racing to zero | Serialized; at least one admin remains; loser gets `409 CONFLICT` |
| Promote/demote | Does **not** revoke refresh tokens or force logout |

**Errors**:

| Condition | HTTP | code |
|-----------|------|------|
| Invalid / missing role | 400 | `VALIDATION_ERROR` |
| Unknown id | 404 | `NOT_FOUND` |
| Last-admin demotion | 409 | `CONFLICT` |

Example last-admin error message (informative, non-leaky):  
`Cannot demote the last remaining admin.`

---

## Out of scope (not in this contract)

- Soft-disable / ban / hard delete
- Password reset
- Changing email / display name via admin
- Client-controlled sort
- Append-only audit event history
