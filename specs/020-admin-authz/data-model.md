# Data Model: Admin AuthZ

**Feature**: `020-admin-authz` | **Date**: 2026-07-12

No new Platform DB tables or migrations. This feature authorizes against existing identity data and JWT claims.

## Existing: User (Platform DB)

Owned by Authentication (`specs/009-authentication`). Relevant fields only:

| Field | Type | Constraints | AuthZ relevance |
|-------|------|-------------|-----------------|
| id | uuid | PK | Subject (`sub`) on access credential |
| email | varchar | unique | Used to locate user for manual promotion |
| role | enum/string | `user` \| `admin` | Source of role at login/refresh; not re-read per admin request in MVP |
| password_hash | string | never exposed | Unchanged |
| display_name | string | | Returned on whoami via `UserProfile` |
| created_at | timestamptz | | Returned on whoami via `UserProfile` |

### Role values

| Value | Meaning |
|-------|---------|
| `user` | Standard learner — denied on admin namespace |
| `admin` | Operator — allowed on admin namespace when present on access credential |

### Manual promotion (local/dev)

Update Platform DB only:

```sql
UPDATE users SET role = 'admin' WHERE email = '<developer-email>';
```

Then sign in again or refresh so the new access credential carries `role: admin`. No playground DB changes.

## Credential projection (not persisted)

Access JWT payload (existing):

| Claim | Type | AuthZ use |
|-------|------|-----------|
| sub | uuid string | User id |
| email | string | Informational |
| role | `user` \| `admin` | **Authoritative** for `RolesGuard` in MVP |

## API view: Admin whoami

Not a table. Successful `GET /api/v1/admin/me` returns existing `UserProfile`:

| Field | Source |
|-------|--------|
| id | users.id |
| email | users.email |
| displayName | users.display_name |
| role | users.role (must be `admin` after AuthZ; loaded via GetMe for consistency) |
| createdAt | users.created_at (ISO-8601) |

## Validation rules

- Admin-namespace handlers MUST declare `@Roles(Role.ADMIN)` (class or method).
- Missing/unrecognized credential role → treat as non-admin → `403 FORBIDDEN`.
- Unauthenticated → `401 UNAUTHORIZED` (JwtAuthGuard).
- No cascade deletes or new FKs introduced by this feature.

## State transitions

| From | Event | To | Notes |
|------|-------|-----|-------|
| role=`user` | Manual Platform DB update | role=`admin` | Credential updates only after login/refresh |
| role=`admin` | Manual Platform DB update | role=`user` | Same; mid-token demotion deferred |
