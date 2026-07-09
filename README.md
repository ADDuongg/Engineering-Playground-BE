# Engineering Playground

Interactive learning platform for engineering concepts — databases, React rendering, system design, caching, and more — through real experiments.

## Concept

The platform is organized into **Tracks** (learning domains). Each Track defines its own Runtime Adapter, Input Surface, Metric Catalog, and Visualization Kit. The MVP ships **Track 1: Database / SQL**.

```
Track → Category → Lab → Experiment
```

## Project Structure

```
sql-play/
├── src/                  # NestJS source (modules, shared contracts)
│   └── shared/           # DTOs, enums, API contracts
├── test/                 # E2E tests
├── docs/
├── infra/
│   ├── docker-compose.yml
│   └── docker/api.Dockerfile
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## Prerequisites

- Node.js >= 22
- pnpm >= 10
- Docker & Docker Compose (for local infrastructure)

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env if needed (JWT_SECRET must be at least 32 characters)
```

### 3. Start infrastructure

```bash
docker compose -f infra/docker-compose.yml up -d postgres_platform postgres_playground redis
```

### 4. Run database migrations

```bash
pnpm migration:run
```

### 5. Start API in development mode

```bash
pnpm dev
```

### 6. Start background workers (optional)

```bash
pnpm dev:benchmark-worker      # load-test labs (requires k6 on PATH)
pnpm dev:dataset-reset-worker  # async dataset reset
pnpm dev:sql-execution-worker  # async interactive SQL runs
```

API: `http://localhost:3001/api/v1`  
Swagger: `http://localhost:3001/api/docs`

## Docker (full stack)

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

## API Endpoints (Auth)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/register` | Public | Register new user |
| POST | `/api/v1/auth/login` | Public | Login |
| POST | `/api/v1/auth/refresh` | Public | Refresh tokens |
| POST | `/api/v1/auth/logout` | Bearer | Revoke refresh token |
| GET | `/api/v1/auth/me` | Bearer | Get profile |
| GET | `/api/v1/health` | Public | Health check |

## Response Format

All API responses follow the standard envelope:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "...", "timestamp": "..." },
  "error": null
}
```

## Architecture

- **Controller → UseCase → Repository** (feature-first, no business logic in controllers)
- **Platform DB** (PostgreSQL): users, progress, quiz, Tracks, Labs — permanent data
- **Runtime Adapters** (per Track): experiment execution — disposable, resettable
  - Database Track → Playground PostgreSQL
  - Redis Track → Playground Redis (future)
  - React Rendering Track → Headless React sandbox (future)
- **Redis**: cache, rate limits, and BullMQ job queues
- **Worker Queue Foundation**: shared job status (`GET /jobs/:jobId`), per-type queues, retry/dead-letter
- **Benchmark Runner**: async k6 via `pnpm dev:benchmark-worker`
- **Dataset Reset**: always async via `pnpm dev:dataset-reset-worker`
- **SQL Execution Queue**: interactive SQL runs async via `pnpm dev:sql-execution-worker` (`POST /experiments/sql/runs` → poll `GET /jobs/:jobId`)

## Scripts

```bash
pnpm dev                       # Start API in watch mode
pnpm dev:benchmark-worker      # Benchmark BullMQ worker (requires k6)
pnpm dev:dataset-reset-worker  # Dataset reset BullMQ worker
pnpm dev:sql-execution-worker  # SQL execution BullMQ worker
pnpm build                     # Build all packages
pnpm test                      # Run unit tests
pnpm test:e2e                  # Run e2e tests
pnpm migration:run             # Run platform DB migrations
pnpm migration:generate -- <name>  # Generate new migration
```

## Jobs / Benchmark API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/jobs/:jobId` | Bearer | Poll any foundation job status |
| POST | `/api/v1/benchmarks` | Bearer | Enqueue benchmark (`jobId` immediately) |
| GET | `/api/v1/benchmarks/:jobId` | Bearer | Compatibility status (prefer `/jobs/:jobId`) |
| GET | `/api/v1/benchmarks/:jobId/progress` | Bearer / session | SSE live progress (push-only; not JSON envelope) |
| POST | `/api/v1/datasets/reset` | Bearer | Enqueue dataset reset (`202` + `jobId`) |

Optional env: `BENCHMARK_PROGRESS_INTERVAL_MS` (default `1000`), `BENCHMARK_PROGRESS_TTL_SECONDS` (default `86400`).

See `specs/012-worker-queue-foundation/quickstart.md` and `specs/015-realtime-progress/quickstart.md` for end-to-end verification.

## Development Notes

- Metrics always originate from Backend (never computed in Frontend)
- Runtime state is disposable per Track; platform data is permanent
- Heavy work (benchmark, dataset reset) runs on BullMQ workers; HTTP handlers never wait for completion
- Adding a new Track requires only a Runtime Adapter, Input Surface, Metric Catalog, and Visualization Kit
