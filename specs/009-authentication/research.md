# Research: Authentication

## Decision: JWT access + opaque refresh tokens with rotation

**Rationale**: Matches existing implementation and industry standard for SPA/API clients. Short-lived JWT limits exposure; refresh rotation detects token reuse.

**Alternatives considered**: Session cookies only (rejected — API-first, future SPA); refresh tokens without rotation (rejected — weaker security).

## Decision: argon2 password hashing

**Rationale**: Already in codebase; OWASP-recommended; superior to bcrypt for new systems.

**Alternatives considered**: bcrypt (already common but argon2 chosen at project start).

## Decision: Email normalization to lowercase at persistence and lookup

**Rationale**: Prevents duplicate accounts; repository layer lowercases on find/create; register use case lowercases before check.

**Alternatives considered**: Case-sensitive emails (rejected — UX and duplicate risk).

## Decision: IP-based rate limiting via @nestjs/throttler on auth endpoints

**Rationale**: Matches contract (5/10/20 per minute); global ThrottlerGuard already registered; per-user limits deferred to Per-User Rate Limit feature.

**Alternatives considered**: Redis sliding window per user (deferred — depends on Authentication).

## Decision: Integration tests against real Platform DB

**Rationale**: Constitution requires integration tests for API endpoints; auth correctness depends on DB persistence and token rotation.

**Alternatives considered**: Controller-only mocked e2e (insufficient for token rotation and conflict scenarios).
