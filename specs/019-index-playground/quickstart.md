# Quickstart: Index Playground

**Feature**: 019-index-playground | **Date**: 2026-07-09

Validate the Index Playground learning loop without FE: lab summary → prepare dataset → SQL before → explain before → create index → SQL after → explain after → quiz.

## Prerequisites

- Platform DB migrated (labs + quiz seed for `index-playground`)
- Playground DB + commerce dataset available
- API + workers required for dataset prepare / SQL as in existing Dataset Loader & Experiment Runner quickstarts
- JWT for a test user
- Base URL example: `$API` = `http://localhost:3000/api/v1`

## 1. Lab summary

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/labs/index-playground/summary"
```

Expect `200` with envelope `{ success, data }`:

- `learningGoal`, `theory`
- `guidedSteps` (≥3; includes explain before/after create-index, `take_quiz`)
- `recommendedQuery.sql` = parameterized `users.email` lookup
- `recommendedCreateIndexSql` / `recommendedDropIndexSql`
- `quizRequired: true`
- `dataset` = commerce / v1 / recommended tiers
- optional `optionalBenchmarkNote` (P2; points at existing Benchmark Runner)

Unauthenticated → `401`. Unknown slug → `404`.

## 2. Prepare playground session

Follow Dataset Loader + Experiment Isolation quickstarts for family `commerce`, version `v1`, tier from summary (e.g. `100k`), `labSlug=index-playground`. Obtain `sessionId` as required by SQL/explain APIs.

## 3. Before: run SQL + explain

Submit summary `recommendedQuery.sql` via Experiment Runner with `parameters` = `recommendedQuery.exampleParameters` (e.g. `["user1@example.com"]`). Running with `parameters: []` fails sandbox validation (`NON_PARAMETERIZED`).

Expect success with execution-focused metrics (`execution_time_ms`, `rows_returned`). Scan keys may appear in `omittedMetricKeys`.

Submit the same SQL via Explain Runner (`explain` or `explain analyze`) with `context.labSlug=index-playground`.

Expect Metric Contract entries:

| key | typical before index |
|-----|----------------------|
| `rows_scanned` | high |
| `seq_scan_used` | `1` |
| `index_scan_used` | `0` |

## 4. Create index

Submit summary `recommendedCreateIndexSql` via Experiment Runner (no dedicated create-index API).

Expect success (sandbox allowlist).

## 5. After: run SQL + explain

Re-run guided SELECT → lower execution time under normal conditions.

Re-run explain with `labSlug=index-playground` → `index_scan_used=1`, lower `rows_scanned` (SC-001/SC-002).

## 6. Drop index (optional regression)

Submit `recommendedDropIndexSql`; re-explain → sequential pattern returns.

## 7. Quiz / progress

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/quizzes/labs/index-playground"
# submit all-correct answers per Quiz Engine quickstart
```

Expect lab completed in progress read after pass.

## 8. Out of scope checks

- No Index-specific benchmark endpoint (`LabsController` only exposes summary)
- No FE charts required
- Redis Track not involved

## Automated tests

```bash
pnpm test -- src/modules/labs
# with PLATFORM_DB_* set:
pnpm test:e2e -- test/integration/index-playground.integration-spec.ts
```

- Unit: summary UseCase, content registry, controller route surface
- Integration: summary auth + content; optional slow SQL/explain loop when playground+redis configured
