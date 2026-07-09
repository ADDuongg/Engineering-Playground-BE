# Research: Per-User Rate Limit

## Decision: Fixed-window Redis counters

**Rationale**: Simple INCR + EXPIRE per window bucket gives predictable limits with minimal complexity. Atomic Lua script prevents race overshoot beyond one request.

**Alternatives considered**: Token bucket (more complex), sliding window log (higher Redis memory), in-memory only (no multi-instance support).

## Decision: Consume quota in UseCases after validation

**Rationale**: Spec FR-008 requires sandbox validation failures not count toward quota. Controller guards would run too early.

**Alternatives considered**: Nest interceptor on routes (rejected — counts failed validations).

## Decision: Identity key = userId || sessionId

**Rationale**: Matches spec FR-001/FR-007. Authenticated users keyed by user id; anonymous experiment flows keyed by session id.

## Decision: Fail closed when Redis unavailable

**Rationale**: Spec edge case — expensive ops must not run unbounded if counter storage is down.
