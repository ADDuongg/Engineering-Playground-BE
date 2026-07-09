# Implementation Plan: Per-User Rate Limit

**Branch**: `010-per-user-rate-limit` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

## Summary

Add a Redis-backed per-identity rate limiting module that enforces separate quotas for SQL runs, EXPLAIN runs, dataset resets, and benchmark enqueues. Limits apply after sandbox validation (for SQL/EXPLAIN) and before expensive work starts. Global `@nestjs/throttler` remains as a backstop.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, ioredis (existing RedisService), Jest

**Storage**: Redis counters (fixed-window buckets per identity + operation)

**Testing**: Unit tests for RateLimitService; integration tests for SQL run limit exhaustion

**Target Platform**: NestJS backend module `src/modules/rate-limit/`

**Constraints**: Fail closed when Redis unavailable for expensive ops; validation failures must not consume quota

## Constitution Check

- [x] Shared types in `src/shared/rate-limit/`
- [x] Controller → UseCase → Service; rate limit consumed in UseCases after validation
- [x] TypeScript strict
- [x] Unit + integration tests
- [x] Learning UX: `RATE_LIMITED` errors with operation label and retry-after
- [x] Platform vs Playground separation preserved
- [x] Simplicity: one RateLimitService, config via env

## Project Structure

```text
src/
├── modules/rate-limit/
│   ├── rate-limit.module.ts
│   └── application/
│       ├── rate-limit.service.ts
│       └── rate-limit.service.spec.ts
├── shared/rate-limit/
│   ├── rate-limit-operation.enum.ts
│   └── index.ts
└── config/
    ├── configuration.ts
    └── env.validation.ts

test/integration/rate-limit.integration-spec.ts
```
