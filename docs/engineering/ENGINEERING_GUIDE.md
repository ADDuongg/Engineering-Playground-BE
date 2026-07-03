# ENGINEERING GUIDE

Version: 1.1

Status: Draft

---

# 1. Purpose

This document defines the engineering standards of Engineering Playground.

Every engineer and AI Agent must follow this guide before implementing any feature.

This guide is the engineering constitution of the project.

---

# 2. Engineering Philosophy

The platform values

- Simplicity
- Predictability
- Maintainability
- Scalability
- Observability
- Reproducibility

Always optimize for long-term maintainability rather than short-term speed.

---

# 3. Development Workflow

Every feature follows the same lifecycle.

Idea

↓

Roadmap

↓

Spec

↓

Requirements

↓

Design

↓

Tasks

↓

Implementation

↓

Review

↓

Tests

↓

Documentation

↓

Merge

Never skip any stage.

---

# 4. Before Writing Code

Before implementation, AI must understand

PRD.md

DOMAIN.md

SYSTEM_DESIGN.md

ARCHITECTURE.md

ROADMAP.md

Current Spec

Never implement features without understanding the current Spec.

---

# 5. Feature Rules

Every feature must

Have a clear purpose.

Remain independently maintainable.

Avoid modifying unrelated modules.

Reuse existing abstractions whenever possible.

---

# 6. Lab Rules

Every Lab belongs to exactly one Track and one Category.

Every Lab must contain

Learning Goal

Experiment

Visualization

Metrics

Quiz

Summary

Every Lab may contain (depending on Track)

Dataset (Database Track)

Benchmark (Database, Redis, Load Testing Tracks)

Configuration Panel (React Rendering, System Design Tracks)

Every Lab should teach exactly one engineering concept.

---

# 6.1 Track Rules

Every Track must declare

Runtime Adapter

Input Surface

Metric Catalog

Visualization Kit

Adding a new Track MUST NOT change the experiment lifecycle or Lab Shell layout.

Not every Track requires a relational dataset or SQL benchmark.

---

# 7. Experiment Rules

Every experiment should be

Deterministic

Repeatable

Measurable

Isolated

Experiments should never depend on previous executions.

---

# 8. Playground Rules

Runtime state (per Track) is disposable.

Platform data is permanent.

Never mix these responsibilities.

Every experiment should execute inside the Track's isolated Runtime Adapter.

Not every Track uses Playground PostgreSQL — each Track declares its own runtime.

---

# 9. AI Implementation Rules

AI must

Read existing implementation first.

Prefer extending existing modules.

Avoid creating duplicate abstractions.

Never invent new architecture.

Never change project structure without explicit approval.

---

# 10. API Rules

Every endpoint

Has DTO

Has Validation

Has OpenAPI documentation

Has Integration Test

Has Error Response

Never expose database models directly.

---

# 11. Database Rules

Always use migrations.

Never modify production datasets directly.

Never couple Platform Database with Playground Database.

Indexes belong to datasets, not platform schema.

---

# 12. SQL Rules

Parameterized queries only.

Never concatenate SQL strings.

Long-running SQL should have timeout.

Explain Analyze should always execute safely.

---

# 13. Benchmark Rules

Benchmarks

Never execute synchronously.

Always run through Worker.

Always collect metrics.

Never block HTTP requests.

---

# 14. Background Job Rules

Heavy work belongs to Workers.

Examples

Benchmark

Dataset Reset

Import

Export

Notification

Never execute these inside request handlers.

---

# 15. Cache Rules

Cache is infrastructure.

Business logic must not depend on Redis.

Removing Redis should not require changing UseCases.

---

# 16. Event Rules

Events communicate across features.

Examples

ExperimentCompleted

BenchmarkFinished

ProgressUpdated

Avoid direct feature-to-feature coupling.

---

# 17. Frontend Rules

Frontend is responsible for

Rendering

Interaction

Visualization

User Experience

Frontend should not calculate engineering metrics.

---

# 18. Backend Rules

Backend is responsible for

Validation

Execution

Metrics

Aggregation

Security

Business Rules

Backend owns the truth.

---

# 19. Visualization Rules

Every chart must originate from backend metrics (Metric Contract).

Frontend never derives engineering metrics.

Visualization should explain behavior, not decorate UI.

Each Track provides a Visualization Kit — the chart types available for its metrics.

Visualization components are Track-aware but reuse shared rendering primitives from `ui/`.

---

# 20. Error Rules

Errors must be actionable and Track-aware.

Instead of

"Query failed"

Display

"Sequential Scan exceeded timeout because no index was available."

Instead of

"Experiment failed"

Display

"Component re-rendered 47 times because parent state changed on every keystroke."

Educational messages are preferred.

---

# 21. Logging Rules

Every request has

Request ID

Track ID

Lab ID

User ID (optional)

Duration

Status

Every benchmark has

Benchmark ID

Worker ID

Metrics

---

# 22. Testing Rules

Every feature requires

Unit Tests

Integration Tests

Critical workflows require

E2E Tests

No feature is complete without tests.

---

# 23. Documentation Rules

Every feature updates

Spec

API

Documentation

Never leave documentation behind implementation.

---

# 24. Performance Rules

Measure before optimizing.

Avoid premature optimization.

Benchmark after optimization.

Every optimization should have measurable impact.

---

# 25. Security Rules

Validate all inputs.

Never trust Frontend.

Rate limit expensive operations.

Sandbox every experiment.

Never execute arbitrary shell commands.

---

# 26. Dependency Rules

Allowed

Controller

↓

UseCase

↓

Repository

Forbidden

Repository

↓

Controller

Repository

↓

Frontend

Worker

↓

Controller

Respect dependency boundaries.

---

# 27. Code Review Rules

Every Pull Request should answer

Why was this change needed?

What engineering problem does it solve?

How is it tested?

Can it affect existing Labs or Tracks?

---

# 28. AI Review Checklist

Before completing implementation

AI should verify

Architecture respected

Spec satisfied

Tests passing

Documentation updated

No duplicated logic

No dead code

No unnecessary abstraction

---

# 29. Definition of Done

A feature is complete only if

Implementation complete

Tests passing

Documentation updated

Metrics verified

Review passed

Spec satisfied

---

# 30. Guiding Principles

Teach through experimentation.

Everything should be measurable.

Everything should be reproducible.

Keep architecture boring.

Keep experiments exciting.

Optimize for understanding instead of complexity.

Every Lab should answer one engineering question.

Never build features without educational value.
