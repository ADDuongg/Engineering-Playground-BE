# Implementation Plan: Quiz Engine

**Branch**: `017-quiz-engine` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-quiz-engine/spec.md`

## Summary

Add Platform DB quiz definitions + per-user quiz attempts with authenticated APIs to fetch a lab quiz (no answer key), submit/grade answers (100% pass), read best-score results, and gate Progress Tracking self-complete for labs that have a quiz. On pass, record lab completion via Progress registry and emit `quiz.completed` (+ reuse `lab.completed` through completion write). Seed at least one MVP quiz via migration.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM, `@nestjs/event-emitter`, existing JWT auth (`JwtAuthGuard`), Progress module (`LabRepository`, `UserLabCompletionRepository` / complete path), Jest + Supertest

**Storage**: Platform PostgreSQL — `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts` (+ optional `quiz_attempt_answers`); **not** playground DB; Redis not used as source of truth

**Testing**: Unit tests (grading 100% rule, best-score selection, gating reject/allow, auth rejects); integration tests (seed quiz, submit pass → progress complete, self-complete blocked until pass, playground reset does not wipe attempts)

**Target Platform**: NestJS API (single process; no worker required)

**Project Type**: Backend web service (Learning Platform feature module)

**Performance Goals**: Passing submit reflected on progress read within 1s (SC-001); definition responses never leak correctness flags

**Constraints**: BE-only APIs; auth on all quiz endpoints; single-select MC only; unlimited retakes / best score; quiz presence ⇒ gated; seed-only quiz authoring; no admin CMS

**Scale/Scope**: MVP ≥1 seeded quiz on an existing catalog lab (e.g. `index-playground`); short quizzes (few questions); multiple attempts per user×quiz

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared quiz types/events in `src/shared/quiz/`
- [x] **Feature-first backend**: Controller → UseCase → Repository; Progress gating via Progress exports / shared completion write — no Repository→Controller
- [x] **TypeScript strict**: Typed entities, DTOs, event payloads; no unjustified `any`
- [x] **Testing**: Unit + integration planned; gating and grading covered
- [x] **Learning UX**: Clear not-found / unauthorized / quiz-required / validation errors for FE
- [x] **Platform vs Playground**: Quizzes + attempts on Platform DB only; unaffected by dataset reset
- [x] **Simplicity**: No Redis; no worker; EventEmitter2 like `lab.completed`; no multi-select/essay

**Post-design note**: Gating modifies `CompleteLabUseCase` (or injects a quiz-pass check) rather than duplicating completion storage. Passing submit calls the same completion persistence path Progress owns.

## Project Structure

### Documentation (this feature)

```text
specs/017-quiz-engine/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/quiz-engine-service.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
src/shared/quiz/
├── quiz-definition.ts           # public definition DTOs (no correct flags)
├── quiz-score-summary.ts
├── quiz-result-summary.ts
├── submit-quiz-result.ts
├── quiz-completed.event.ts      # QUIZ_COMPLETED_EVENT + payload
└── index.ts

src/modules/quiz/
├── quiz.module.ts
├── quiz.controller.ts           # get definition, submit, get result (all auth)
├── application/
│   ├── get-quiz-definition.usecase.ts
│   ├── submit-quiz.usecase.ts
│   ├── get-quiz-result.usecase.ts
│   ├── grade-quiz.service.ts    # pure grading helper (optional extract)
│   └── *.spec.ts
├── infrastructure/
│   ├── quiz.repository.ts
│   ├── quiz-attempt.repository.ts
│   └── *.spec.ts (optional)
├── entities/
│   ├── quiz.entity.ts
│   ├── quiz-question.entity.ts
│   ├── quiz-option.entity.ts
│   └── quiz-attempt.entity.ts
├── dto/
│   ├── lab-slug.param.dto.ts    # or reuse progress DTO pattern
│   └── submit-quiz.dto.ts
└── mappers/
    └── quiz.mapper.ts

src/modules/progress/
└── application/complete-lab.usecase.ts   # gate: reject if lab has quiz and user has no passing attempt

src/database/migrations/
└── 1730500000000-CreateQuizTablesAndSeed.ts   # tables + seed quiz for index-playground

src/app.module.ts                  # register QuizModule

test/integration/
└── quiz-engine.integration-spec.ts
```

**Structure Decision**: New `QuizModule` owns definitions, grading, attempts, and result reads. Progress remains the sole completion registry; QuizModule calls into Progress’s completion write (exported UseCase or shared application service) on pass, and Progress’s self-complete checks Quiz for a passing attempt when a quiz exists. No FE package changes.

## Complexity Tracking

> No constitution violations requiring justification. Cross-module Progress↔Quiz coupling is required by the spec (gating + completion on pass) and stays at UseCase/event boundaries.
