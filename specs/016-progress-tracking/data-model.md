# Data Model: Progress Tracking

## Lab (Platform DB)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| slug | varchar(128) | UNIQUE globally, immutable after seed |
| title | varchar(200) | required |
| description | text | optional, nullable |
| track_id | uuid | FK → tracks.id, ON DELETE RESTRICT |
| sequence_order | int | required; order within Track learning path |
| created_at | timestamptz | auto |
| updated_at | timestamptz | auto |

**Indexes**: unique `slug`; index `(track_id, sequence_order)`.

**Seed (MVP, Database / SQL Track)** — illustrative slugs (finalize in migration):

| sequence_order | slug | title |
|----------------|------|-------|
| 1 | index-playground | Index Playground |
| 2 | explain-analyze | Explain Analyze Lab |
| 3 | offset-vs-cursor | Offset vs Cursor Lab |
| 4 | benchmark-lab | Benchmark Lab |

## UserLabCompletion (Platform DB)

| Field | Type | Constraints |
|-------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK → users.id, ON DELETE CASCADE |
| lab_id | uuid | FK → labs.id, ON DELETE CASCADE |
| completed_at | timestamptz | set on first completion; not updated on idempotent retry |
| created_at | timestamptz | auto |

**Indexes**: UNIQUE `(user_id, lab_id)`.

## Derived: TrackProgressSummary (API view, not a table)

| Field | Meaning |
|-------|---------|
| trackSlug | Track slug |
| totalLabs | Count of labs in path for Track |
| completedCount | Completions for this user among those labs |
| percentComplete | `round(completedCount / totalLabs * 100)` or 0 if totalLabs=0 |
| completedLabSlugs | List of completed lab slugs in path order |
| labs | Optional: path items with `completed: boolean` for FE convenience |

## State transitions

```text
UserLabCompletion: (absent)
    → completed (first successful self-complete)
    → (no revoke in MVP)
```

Idempotent complete when row exists: no state change; no new event.

## Validation rules

- `labSlug`: non-empty, must exist in catalog
- Complete: user authenticated; lab’s Track status must be `active`
- Progress read: user authenticated; Track must exist
- Learning path: Track must exist (public); empty list OK
