# ARCHITECTURE

Version: 1.1

Status: Draft

---

# 1. Purpose

This document defines the software architecture of Engineering Playground.

It specifies:

- Project organization
- Module boundaries
- Dependency rules
- Coding conventions
- Package responsibilities

It does NOT describe runtime flows.

Runtime behavior belongs to SYSTEM_DESIGN.md.

---

# 2. Architecture Philosophy

The platform follows these principles.

Feature First

Domain Driven

Stateless Backend

Composable Frontend

Shared Contracts

Single Responsibility

Every feature should be independently maintainable.

---

# 3. Monorepo Structure

```
engineering-playground/

src/
    modules/        # NestJS feature modules
    shared/         # DTOs, enums, API contracts
    database/
    config/

test/

tracks/             # planned
    database/
    react-rendering/
    system-design/
    redis/

docs/

infra/

scripts/
```

---

# 4. Backend Application

## src/modules

Responsible for

- Authentication
- Experiment Execution
- Benchmark
- Dataset
- Progress
- Quiz

---

# 5. Shared Contracts

## src/shared

Shared DTO

Enums

Interfaces

Schema

Imported via `@db-play/types` path alias.

---

# 6. Feature Organization

Every feature follows

```
feature/

controller

usecase

repository

dto

mapper

validator

events

tests
```

Never organize code by file type globally.

Always organize by feature.

---

# 7. Backend Layer

```
Controller

↓

UseCase

↓

Repository

↓

Database
```

Rules

Controller

Only receives requests.

No business logic.

UseCase

Contains business logic.

Repository

Database only.

No business logic.

---

# 8. Frontend Layer

```
Page

↓

Feature

↓

Hook

↓

API Client

↓

Backend
```

UI components should remain dumb.

Business logic belongs inside Feature.

---

# 9. Dependency Rules

Allowed

```
Controller

↓

UseCase

↓

Repository
```

Forbidden

```
Repository

↓

Controller
```

UseCases must never call another UseCase directly.

Communication should occur through Events.

---

# 10. Event Driven Design

Long running tasks should publish events.

Examples

BenchmarkStarted

ExperimentCompleted

DatasetReset

ProgressUpdated

Background processing belongs to Workers.

---

# 11. API Design

REST first.

Future

SSE

WebSocket

Versioning

/api/v1

Response format

```
success

data

meta

error
```

---

# 12. DTO

All requests

↓

DTO

↓

Validation

↓

UseCase

Never expose ORM models.

---

# 13. Validation

Frontend validates UX.

Backend validates security.

Backend validation is always authoritative.

---

# 14. Error Handling

Errors

↓

Domain Error

↓

Application Error

↓

HTTP Error

↓

Frontend

Never expose stack traces.

---

# 15. Authentication

JWT

Refresh Token

Role Based Access

Permission based when required.

---

# 16. Repository

Repositories

Only database interaction.

No business logic.

No HTTP.

No Redis logic.

---

# 17. Cache

Cache belongs to Infrastructure.

Business logic must not know cache implementation.

Cache strategy

Cache Aside

Write Through

can be swapped without changing UseCases.

---

# 18. Background Jobs

Heavy tasks

↓

BullMQ

↓

Worker

↓

Result

HTTP requests should remain short.

---

# 19. Benchmark Runner

Benchmark execution

↓

Queue

↓

Worker

↓

k6

↓

Metrics

↓

Storage

Benchmark never executes inside HTTP request.

---

# 20. Runtime Adapters

Each Track declares a Runtime Adapter that executes experiments.

Runtime Adapters are infrastructure — application code never depends directly on implementation.

| Track | Runtime Adapter |
|-------|----------------|
| Database / SQL | Playground PostgreSQL |
| Redis | Playground Redis |
| Kafka | Playground Kafka |
| React Rendering | Headless React sandbox |
| System Design | Simulation engine |

Not every Track uses Playground PostgreSQL. Tracks like React Rendering and System Design use dedicated runtimes.

Runtime services (PostgreSQL, Redis, Kafka, Docker) are infrastructure behind adapters.

---

# 21. Database

Platform Database

↓

Repositories

↓

Entities

Stores: users, progress, quiz, Tracks, Labs, settings — permanent data.

Runtime Databases (per Track)

↓

Runtime Adapter

↓

Experiment Runner

↓

Metrics

Playground PostgreSQL serves Database Track only. Other Tracks use their own runtime (Redis, Kafka, sandbox, simulation).

Never mix Platform and Runtime responsibilities.

---

# 22. Logging

Every request

↓

Request ID

↓

Structured Log

↓

Tracing

↓

Metrics

---

# 23. Testing

Unit Test

↓

Integration Test

↓

E2E

Every feature should contain tests.

---

# 24. AI Agent Rules

AI should

Respect folder structure.

Never introduce new patterns.

Never duplicate existing abstractions.

Always reuse shared packages.

Never bypass UseCase layer.

Always follow dependency rules.

---

# 25. Coding Standards

Prefer Composition.

Avoid Inheritance.

Small Functions.

Explicit Naming.

Pure Functions when possible.

Immutability preferred.

---

# 26. Performance Principles

Avoid unnecessary database calls.

Avoid duplicated network requests.

Prefer pagination.

Prefer background jobs.

Cache expensive reads.

Lazy load expensive resources.

Measure before optimizing.

---

# 27. Security Principles

Validate every input.

Never trust Frontend.

Parameterized SQL only.

Sandbox experiments.

Least privilege.

Rate limiting.

Audit logging.

---

# 28. Future Extensions

New Tracks should only add

Runtime Adapter

Input Surface

Metric Catalog

Visualization Kit

Labs

without changing existing architecture or the experiment lifecycle.

New Labs within an existing Track should only add

Feature

Experiment

Visualization

without changing the Track's adapter or shell.

---

# 29. Architecture Goals

Simple.

Predictable.

Scalable.

Testable.

AI Friendly.
