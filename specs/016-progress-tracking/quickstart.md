# Quickstart: Progress Tracking

**Feature**: 016-progress-tracking

## Prerequisites

- Node.js ≥ 22, pnpm ≥ 10
- Platform PostgreSQL running (see `.env`)
- Migrations applied including labs + completions seed
- API base URL: `http://localhost:${PORT}/api/v1`
- A registered user + access token (see Authentication quickstart)

## Setup

```bash
pnpm install
pnpm migration:run
pnpm dev
```

## Validate — Public learning path

```bash
curl -s http://localhost:${PORT}/api/v1/tracks/database-sql/learning-path | jq .
```

**Expected**: `success: true`, `data.labs` length ≥ 1, ordered by `sequenceOrder`, no `completed` field.

## Validate — Progress before complete

```bash
curl -s http://localhost:${PORT}/api/v1/progress/tracks/database-sql \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected**: `completedCount: 0`, `percentComplete: 0`, all `labs[].completed: false`.

## Validate — Self-complete

```bash
curl -s -X POST http://localhost:${PORT}/api/v1/progress/labs/index-playground/complete \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected**: `alreadyCompleted: false`, `completedAt` set, `trackSlug: database-sql`.

Repeat the same POST → `alreadyCompleted: true`, same `completedAt`.

## Validate — Progress after complete

```bash
curl -s http://localhost:${PORT}/api/v1/progress/tracks/database-sql \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected**: `completedCount: 1`, `completedLabSlugs` includes `index-playground`, matching lab `completed: true`.

## Validate — Auth required

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://localhost:${PORT}/api/v1/progress/labs/index-playground/complete
```

**Expected**: `401`.

## Validate — Unknown lab

```bash
curl -s -X POST http://localhost:${PORT}/api/v1/progress/labs/does-not-exist/complete \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
```

**Expected**: `404` / `NOT_FOUND`.

## Automated checks

```bash
pnpm test -- progress
pnpm test:e2e -- progress-tracking
```

(Adjust test path filters to match implemented specs.)
