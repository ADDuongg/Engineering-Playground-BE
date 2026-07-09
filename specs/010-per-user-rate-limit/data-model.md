# Data Model: Per-User Rate Limit

## RateLimitOperation (enum)

| Value | Description |
| ----- | ----------- |
| `sql_run` | Experiment Runner SQL execution |
| `explain_run` | Explain Runner execution |
| `dataset_reset` | Dataset reset trigger |
| `benchmark_enqueue` | Future benchmark job submission |

## Redis Counter Key

Pattern: `ratelimit:{operation}:{identityType}:{identityId}:{windowBucket}`

- `identityType`: `user` | `session`
- `windowBucket`: floor(unixSeconds / windowSeconds)

TTL: window duration + 1 second buffer.

## RateLimitPolicy (configuration, not persisted)

| Field | Source |
| ----- | ------ |
| operation | RateLimitOperation |
| limit | env per operation |
| windowSeconds | shared env default (60) |
| elevatedMultiplier | optional env |

## RateLimitEvent (observability log)

Emitted on rejection: identityType, identityId, operation, endpoint hint, timestamp.
