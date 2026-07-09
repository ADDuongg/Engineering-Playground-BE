# Data Model: Authentication

## User (Platform DB)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK, auto-generated |
| email | varchar(255) | unique, stored lowercase |
| password_hash | varchar(255) | argon2 hash, never exposed |
| display_name | varchar(100) | 2–100 chars at registration |
| role | enum | `user` \| `admin`, default `user` |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto |

## RefreshToken (Platform DB)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → users, CASCADE delete |
| token_hash | varchar(255) | SHA-256 of opaque token |
| expires_at | timestamptz | default +7 days |
| revoked_at | timestamptz | null when valid |
| created_at | timestamptz | auto |

## State transitions

```text
RefreshToken: active (revoked_at=null, expires_at>now)
           → revoked (logout or rotation)
           → expired (expires_at<now, treated as invalid)
```

## Validation rules (API input)

- Register: email (valid), password (8–72), displayName (2–100)
- Login: email (valid), password (min 8)
- Refresh/Logout: refreshToken (non-empty string)
