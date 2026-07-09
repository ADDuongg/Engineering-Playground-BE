# API Contract: Progress Tracking

**Feature**: 016-progress-tracking | **Module**: `ProgressModule` | **Base paths**: `/tracks`, `/progress`

All JSON responses use the standard API envelope: `{ success, data, meta, error }` unless noted.

---

## GET /tracks/:trackSlug/learning-path

**Purpose**: Public ordered lab catalog for a Track (no user completion data).

**Auth**: Public (`@Public()`)

### Response `200 OK`

```typescript
interface TrackLearningPathResponse {
  trackSlug: string;
  labs: LabPathItem[];
}

interface LabPathItem {
  slug: string;
  title: string;
  description?: string | null;
  sequenceOrder: number;
}
```

Labs sorted by `sequenceOrder` ascending, then slug.

### Errors

| ErrorCode | HTTP | When |
|-----------|------|------|
| `NOT_FOUND` | 404 | Unknown track slug |

Empty `labs: []` when Track exists but has no seeded labs.

---

## GET /progress/tracks/:trackSlug

**Purpose**: Authenticated progress summary for the current user on a Track.

**Auth**: JWT required

### Response `200 OK`

```typescript
interface TrackProgressSummaryResponse {
  trackSlug: string;
  totalLabs: number;
  completedCount: number;
  percentComplete: number; // 0–100 integer
  completedLabSlugs: string[];
  labs: Array<LabPathItem & { completed: boolean }>;
}
```

`percentComplete` is `0` when `totalLabs === 0`.

### Errors

| ErrorCode | HTTP | When |
|-----------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `NOT_FOUND` | 404 | Unknown track slug |

---

## POST /progress/labs/:labSlug/complete

**Purpose**: Authenticated self-complete for a catalog lab (idempotent).

**Auth**: JWT required

**Body**: none required (empty object allowed)

### Response `200 OK`

```typescript
interface CompleteLabResult {
  labSlug: string;
  trackSlug: string;
  completedAt: string; // ISO timestamptz
  alreadyCompleted: boolean; // true if idempotent no-op
}
```

### Side effects

- On **first** completion (`alreadyCompleted: false`): persist row; emit domain event `lab.completed`.
- On idempotent retry: return existing `completedAt`; **do not** re-emit event.

### Errors

| ErrorCode | HTTP | When |
|-----------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid token |
| `NOT_FOUND` | 404 | Unknown lab slug |
| `VALIDATION_ERROR` / `FORBIDDEN` | 400/403 | Lab’s Track is not `active` (coming-soon / not startable) |
| `FORBIDDEN` | 403 | Lab has a quiz and the user has no passing attempt yet (see [017-quiz-engine](../../017-quiz-engine/contracts/quiz-engine-service.md)) |

No uncomplete endpoint.

---

## Domain event: `lab.completed`

```typescript
export const LAB_COMPLETED_EVENT = 'lab.completed';

export interface LabCompletedEvent {
  userId: string;
  labSlug: string;
  trackSlug: string;
  completedAt: string; // ISO
}
```

Emitted in-process via EventEmitter2 after successful first insert. Subscribers (e.g. future Quiz Engine) MUST NOT be required for Progress correctness.

---

## Out of scope (this contract)

- Admin lab CRUD
- Uncomplete / revoke
- Quiz score storage / grading (owned by Quiz Engine; this contract only documents the self-complete gate)
- Anonymous progress
- Redis-backed progress store
