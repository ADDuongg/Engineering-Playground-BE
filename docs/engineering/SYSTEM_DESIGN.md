# SYSTEM DESIGN

Version: 1.1

Status: Draft

---

# 1. Purpose

This document describes how the system works from an end-to-end perspective.

It does NOT describe:

- Folder structure
- Clean Architecture
- Framework implementation
- Coding convention

Those belong to ARCHITECTURE.md.

This document focuses on:

- Runtime behavior
- Data flow
- Component interaction
- Experiment lifecycle
- User workflows

---

# 2. System Overview

Engineering Playground is an interactive platform that allows developers to learn engineering concepts through isolated experiments across multiple Tracks.

Every experiment follows the same lifecycle regardless of Track:

User
↓
Read Theory
↓
Execute Experiment
↓
Observe Metrics
↓
Modify Configuration
↓
Execute Again
↓
Compare Results
↓
Complete Learning

The platform should always prioritize experimentation over explanation.

---

# 3. Core Components

The system consists of five logical components.

Frontend

Responsible for:

- User Interface
- Input Surfaces (pluggable per Track)
- Charts
- Metrics Visualization
- Authentication
- Progress Tracking
- Track Browser

Backend API

Responsible for:

- Authentication
- Validation
- Experiment Orchestration
- Dataset Management
- Benchmark Scheduling
- Metrics Aggregation

Playground Runtime (Runtime Adapters)

Responsible for:

- PostgreSQL (Database Track)
- Redis (Redis Track)
- Kafka (Kafka Track)
- Headless React sandbox (React Rendering Track)
- Simulation engine (System Design Track)
- BullMQ
- Other infrastructure used by Tracks

Benchmark Runner

Responsible for:

- k6 execution
- Benchmark lifecycle
- Metrics collection

Platform Database

Responsible for:

- User Accounts
- Progress
- Quiz
- Benchmark History
- Platform Metadata

---

# 4. Runtime Separation

The Platform Database is NOT the same as the Playground Database.

Platform Database stores:

- Users
- Progress
- Tracks
- Labs
- Quiz
- Settings

Runtime Databases (per Track) store experiment data:

- Database Track: users, products, orders, payments, etc. (Playground PostgreSQL)
- Redis Track: cache keys and values (Playground Redis)
- Other Tracks: Track-specific disposable data

Runtime data can always be reset.

Platform data must never be reset.

---

# 5. User Journey

A user enters the platform.

↓

Authenticates.

↓

Chooses a Lab.

↓

Reads learning objective.

↓

Runs experiments.

↓

Observes metrics.

↓

Changes configuration.

↓

Runs experiment again.

↓

Compares results.

↓

Completes quiz.

↓

Progress is updated.

---

# 6. Experiment Lifecycle

Every Lab follows the same lifecycle.

Preparation

↓

Dataset Ready

↓

Experiment Starts

↓

Execution

↓

Metrics Collection

↓

Visualization

↓

Learning Summary

↓

Quiz

↓

Progress Update

Every Lab must follow this lifecycle.

---

# 7. Run Experiment Flow

User provides input via Track-specific Input Surface.

↓

Frontend validates basic input (syntax, schema, config).

↓

Backend validates permissions and resolves Runtime Adapter for the Lab's Track.

↓

Experiment executed inside the Track's Runtime Adapter.

↓

Track-specific metrics collected (e.g. execution plan for SQL, render count for React).

↓

Response returned as Metric Contract objects.

↓

Charts updated using Track's Visualization Kit.

No experiment should execute directly against Platform Database.

### Database Track example (SQL)

User writes SQL → Frontend syntax check → Backend permissions →
Playground PostgreSQL execution → EXPLAIN/metrics → Response → Charts

---

# 8. Benchmark Flow

User configures:

- RPS
- Duration

↓

Frontend sends Benchmark Request.

↓

Backend creates Benchmark Job.

↓

BullMQ schedules execution.

↓

Worker starts.

↓

k6 container starts.

↓

Benchmark executes.

↓

Metrics collected.

↓

Worker stores result.

↓

Frontend receives live updates.

Benchmark execution must always be asynchronous.

HTTP requests should never wait for benchmark completion.

---

# 9. Dataset Reset Flow

User clicks Reset Dataset.

↓

Backend validates Lab.

↓

Playground Runtime destroys current dataset.

↓

Seed script executed.

↓

Indexes recreated.

↓

Dataset ready.

↓

Frontend notified.

Every Lab must always be reset to a deterministic state.

---

# 10. Explain Analyze Flow

User executes SQL.

↓

Backend runs

EXPLAIN ANALYZE

↓

Execution Plan returned.

↓

Parser converts raw plan into structured metrics.

↓

Frontend renders:

- Tree
- Cost
- Rows
- Scan Type

Raw execution plans should never be rendered directly.

---

# 11. Metrics Pipeline

Every experiment produces metrics via the Track's Metric Catalog.

Experiment Output

↓

Track-specific Parser

↓

Metric Contract (`key`, `label`, `unit`, `value`, `group`)

↓

Visualization

Frontend should never calculate metrics.

All metrics originate from Backend.

---

# 12. Metric Contract & Per-Track Catalogs

All metrics follow the shared Metric Contract:

```
{ key, label, unit, value, group }
```

Each Track declares its own Metric Catalog. Examples:

**Database Track:**

Execution Time, Rows Scanned, Rows Returned, Index Used, Scan Type, Memory, CPU, Buffer Hits, Cache Hits, Latency, P95, P99, Throughput, Errors

**React Rendering Track:**

Render Count, Commit Duration, Component Tree Depth, Memo Hit Rate

**System Design Track:**

Request Latency, Throughput, Error Rate, Cache Hit Ratio

Benchmark-specific metrics may extend a Track's catalog.

---

# 13. Playground Isolation

Every experiment runs inside an isolated runtime.

Experiments must never modify platform data.

Experiments must never access production resources.

Experiments should be disposable.

---

# 14. Security

Only predefined datasets.

No arbitrary shell execution.

Resource limits.

SQL timeout.

Rate limiting.

Container isolation.

Authentication required.

---

# 15. Progress Tracking

Progress updates only after:

Experiment completed

or

Quiz completed

Progress is stored in Platform Database.

---

# 16. Authentication

Authentication protects:

Progress

Bookmarks

History

Premium Features

Learning experiments should remain publicly accessible when possible.

---

# 17. Error Handling

Errors should always be categorized.

Validation Error

Execution Error

Timeout

Permission Error

Sandbox Error

Internal Error

Frontend should display educational messages whenever possible.

---

# 18. Scalability

Multiple users may execute experiments simultaneously.

Long-running tasks should always be delegated to background workers.

Stateless Backend.

Horizontally scalable API.

Independent Benchmark Workers.

Disposable Playground Runtime.

---

# 19. Observability

Every experiment generates logs.

Every benchmark generates metrics.

Every worker emits events.

The platform should expose:

Request latency

Benchmark latency

Job duration

Worker health

Database latency

---

# 20. System Events

Important domain events include:

ExperimentStarted

ExperimentCompleted

BenchmarkStarted

BenchmarkCompleted

DatasetReset

QuizCompleted

ProgressUpdated

These events may be consumed by future services.

---

# 21. Future Extensions

The system should support new Tracks:

Database / SQL

Redis

Kafka

MongoDB

Browser Rendering

React Rendering

System Design

Linux Performance

without changing the experiment lifecycle.

Adding a new Track requires only:

- Runtime Adapter
- Input Surface
- Metric Catalog
- Visualization Kit
- Labs

---

# 22. Design Principles

Every Lab behaves consistently.

Every metric comes from Backend.

Every experiment is isolated.

Everything is measurable.

Everything is reproducible.

Users should learn through observation rather than memorization.
