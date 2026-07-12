# Data Model: User Admin

**Feature**: `024-user-admin` | **Date**: 2026-07-12

Platform DB only. No playground tables.

## User (existing — extended)

Table: `users`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK | Stable id |
| email | varchar(255) | unique, required | Lowercased on write (existing) |
| password_hash | varchar(255) | required | **Never** returned on admin APIs |
| display_name | varchar(100) | required | |
| role | enum | `user` \| `admin` | Mutable via admin PATCH |
| updated_by | uuid | nullable, FK → users(id) ON DELETE SET NULL | **NEW** — acting admin of last actual role change |
| created_at | timestamptz | | List sort primary key |
| updated_at | timestamptz | | Updated on real role change (and other existing writes) |

### Migration

- Add `updated_by` nullable uuid + FK to `users(id)` ON DELETE SET NULL
- No backfill required (`NULL` until first admin role change)
- Existing seed admins/users unchanged

### Validation

- Role update body: required `role` ∈ {`user`, `admin`}
- Target user must exist → else `NOT_FOUND`
- Demotion (`admin` → `user`) forbidden when it would leave zero admins (including concurrent races) → `CONFLICT`
- Same-role request: success no-op; do not change `updated_at` / `updated_by`
- Search `q`: optional string; match email OR display_name ILIKE `%q%`
- Pagination: `page` ≥ 1; `limit` 1–100 (defaults 1 / 20)

### Role transitions

| From | Event | To | Side effects |
|------|-------|----|--------------|
| `user` | Admin sets `admin` | `admin` | Set `updated_by` = acting admin id; bump `updated_at` |
| `admin` | Admin sets `user` (not last admin) | `user` | Set `updated_by`; bump `updated_at`; no token revoke |
| `admin` | Admin sets `user` (would be last admin) | (unchanged) | Reject `CONFLICT` |
| any | Admin sets same role | (unchanged) | No metadata write |

### Operator-visible projection (`AdminUserView`)

| Field | Source |
|-------|--------|
| id | users.id |
| email | users.email |
| displayName | users.display_name |
| role | users.role |
| updatedBy | users.updated_by (null if never role-updated via admin) |
| createdAt | users.created_at |
| updatedAt | users.updated_at |

**Excluded**: `passwordHash`, refresh tokens, any credential material.

### Relationships

- `updated_by` → optional self-FK to another (or same) user who performed the last admin role change
- Refresh tokens remain owned by auth module; User Admin never lists or mutates them
