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
- **Redis**: cache & future BullMQ queues

## Scripts

```bash
pnpm dev              # Start API in watch mode
pnpm build            # Build all packages
pnpm test             # Run unit tests
pnpm test:e2e         # Run e2e tests
pnpm migration:run    # Run platform DB migrations
pnpm migration:generate -- <name>  # Generate new migration
```

## Development Notes

- Metrics always originate from Backend (never computed in Frontend)
- Runtime state is disposable per Track; platform data is permanent
- Heavy tasks (benchmark, dataset reset) will use BullMQ workers (future epic)
- Adding a new Track requires only a Runtime Adapter, Input Surface, Metric Catalog, and Visualization Kit
