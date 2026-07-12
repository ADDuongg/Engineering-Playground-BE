# Implementation Plan: Quiz Admin CRUD

**Branch**: `023-quiz-admin-crud` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-quiz-admin-crud/spec.md`

## Summary

Expose admin CRUD for per-lab quiz definitions on existing Platform tables (`quizzes`, `quiz_questions`, `quiz_options`) under `/api/v1/admin/*`. Question create is atomic with inline options; afterward options are managed granularly. Admin reads include `isCorrect`; learner definition APIs remain unchanged (no correct flags). Hard-delete quiz cascades attempts; lab completions are preserved. No playground writes; no schema redesign beyond repository write paths.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js ≥ 22

**Primary Dependencies**: NestJS 11, TypeORM (Platform DB), class-validator, existing Admin AuthZ / Quiz / Progress modules, Jest + Supertest

**Storage**: Platform DB only — reuse existing quiz tables from 017; extend repositories with create/update/delete/reorder; no playground schema changes

**Testing**: Unit tests for quiz/question/option/reorder/delete use cases + answer-key invariants; integration tests for AuthZ, gating-on-shell, learner definition still hides `isCorrect`, cascade delete keeps completions

**Target Platform**: NestJS API service (backend-only)

**Project Type**: Web-service API (NestJS monorepo backend)

**Performance Goals**: Admin get/list and learner definition p95 ≤ 200ms under normal load; reorder/create ≤ 500ms; no playground round-trips

**Constraints**: Platform vs playground separation; one quiz per lab; gate on shell existence; hard delete quiz + attempts; keep lab completions; single-select only; FE admin UI out of scope; learner submit/grade/gate semantics unchanged

**Scale/Scope**: Admin authoring for any Lab; Index Playground seeded quiz remains editable; shared admin quiz types in `src/shared/`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Contracts**: Shared admin quiz types in `src/shared/`; reuse learner quiz public types without exposing `isCorrect`
- [x] **Feature-first backend**: Admin controllers → UseCases → Quiz repositories; no forbidden deps
- [x] **TypeScript strict**: No unjustified `any`
- [x] **Testing**: Unit + integration planned; AuthZ, answer-key invariants, delete/completion covered
- [x] **Learning UX**: Actionable validation/conflict/not-found errors; learner definition contract unchanged
- [x] **Platform vs Playground**: Quiz content on Platform DB only; playground untouched
- [x] **Simplicity**: Extend admin + quiz modules; no new CMS/versioning layer; reuse existing tables

**Post-design re-check**: Pass — design reuses 017 schema and admin AuthZ patterns; adds write use cases and admin controller; no new architectural layers.

## Project Structure

### Documentation (this feature)

```text
specs/023-quiz-admin-crud/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/quiz-admin-api.md
└── tasks.md                 # /speckit-tasks (not created by plan)
```

### Source Code (repository root)

```text
src/shared/
├── quiz/
│   ├── quiz-responses.ts           # existing learner contracts (unchanged)
│   └── quiz-admin.ts               # NEW: admin quiz/question/option views + requests
└── index.ts                        # export new types

src/modules/admin/
├── admin.module.ts                 # register quiz-admin controller/usecases; import QuizModule exports
├── admin-quiz.controller.ts        # NEW: /admin/labs/:labSlug/quiz...
├── application/
│   ├── create-lab-quiz.usecase.ts
│   ├── update-lab-quiz.usecase.ts
│   ├── delete-lab-quiz.usecase.ts
│   ├── get-admin-lab-quiz.usecase.ts
│   ├── create-quiz-question.usecase.ts
│   ├── update-quiz-question.usecase.ts
│   ├── delete-quiz-question.usecase.ts
│   ├── create-quiz-option.usecase.ts
│   ├── update-quiz-option.usecase.ts
│   ├── delete-quiz-option.usecase.ts
│   ├── reorder-quiz-questions.usecase.ts
│   ├── reorder-quiz-options.usecase.ts
│   ├── quiz-answer-key.validator.ts
│   └── *.spec.ts
├── dto/                            # create/update/reorder/param DTOs
└── mappers/admin-quiz.mapper.ts    # entity → admin views (includes isCorrect)

src/modules/quiz/
├── entities/                       # existing — no structural change expected
├── infrastructure/
│   ├── quiz.repository.ts          # EXTEND: create/update/delete + transactional helpers
│   ├── quiz-question.repository.ts # NEW or extend writes (questions/options/reorder)
│   └── quiz-option.repository.ts   # NEW or colocated writes
├── application/                    # learner use cases unchanged except empty-submit guard if missing
└── quiz.module.ts                  # export write repos for admin

test/integration/
└── quiz-admin.integration-spec.ts
```

**Structure Decision**: Operator HTTP under `src/modules/admin/`. Persistence stays in `src/modules/quiz/` (owns entities/repos). Prefer extending `QuizRepository` plus focused question/option write helpers over duplicating TypeORM access in admin.

## Complexity Tracking

No constitution violations requiring justification.
