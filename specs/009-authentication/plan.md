# Implementation Plan: Authentication

**Branch**: `009-authentication` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

## Summary

Complete the existing `auth` NestJS module so learners can register, sign in, refresh sessions, view profile, and sign out securely. User and refresh-token data live on Platform DB. JWT access tokens plus opaque refresh tokens with rotation on refresh. Shared contracts in `src/shared/auth/`. Backend module is partially implemented — remaining work is integration tests, unit test coverage for all use cases, and contract alignment.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM, PostgreSQL (Platform DB), Passport JWT, argon2, @nestjs/throttler, Jest

**Storage**: Platform DB — `users`, `refresh_tokens` (migration `1730000000000-InitAuthTables`)

**Testing**: Unit tests (all UseCases + TokenService); integration tests (real Platform DB + HTTP supertest covering contract scenarios)

**Performance Goals**: Register/login p95 ≤ 500ms under normal load; refresh p95 ≤ 300ms

**Constraints**: Standard API envelope on all auth endpoints except logout (204); passwords never in logs/responses; email normalized to lowercase

**Scale/Scope**: MVP email/password only; default role `user`; IP rate limits on auth endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: `UserProfile`, `AuthTokens`, `AuthResponse`, `Role` in `src/shared/auth/`
- [x] **Feature-first backend**: Controller → UseCase → Repository; TokenService for token lifecycle
- [x] **TypeScript strict**: No unjustified `any`
- [x] **Testing**: Unit + integration tests planned
- [x] **Learning UX**: Actionable auth errors; generic login failure message
- [x] **Platform vs Playground**: User data on Platform DB only; unaffected by playground reset
- [x] **Simplicity**: Reuse existing auth module; no OAuth/password-reset in MVP

## Project Structure

### Documentation (this feature)

```text
specs/009-authentication/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/auth-api.md
└── tasks.md
```

### Source Code (repository root)

```text
src/modules/auth/
├── auth.module.ts
├── auth.controller.ts
├── dto/
├── application/
├── entities/
├── infrastructure/
├── mappers/
└── strategies/

src/shared/auth/
test/integration/auth.integration-spec.ts
test/auth.e2e-spec.ts
```

**Structure Decision**: Extend existing auth module rather than creating a parallel module — aligns with partial implementation noted in BACKLOG.

## Complexity Tracking

No constitution violations requiring justification.
