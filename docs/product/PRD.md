# Product Requirements Document (PRD)

# Engineering Playground

Version: 1.1

Status: Draft

Owner: Nguyen Van Duong

---

# 1. Vision

Engineering Playground is an interactive learning platform that helps developers understand how real systems work through experimentation instead of passive tutorials.

The platform supports multiple **Tracks** — learning domains such as databases, React rendering, system design, caching, and distributed systems. Each Track teaches engineering concepts through isolated, measurable experiments.

Users should be able to:

- Run experiments across different Tracks
- Visualize system behavior (execution plans, render trees, architecture diagrams)
- Compare performance before and after optimization
- Benchmark systems under load
- Observe the effects of indexes, transactions, caching, concurrency, and rendering patterns
- Learn production-level engineering concepts without installing infrastructure locally

The platform should prioritize experimentation over theory.

---

# 2. Problem Statement

Learning engineering concepts is difficult because most resources only explain theory.

Developers rarely see:

- Why OFFSET becomes slower
- What EXPLAIN ANALYZE actually means
- When Redis helps
- Why indexes matter
- What deadlocks look like
- How transaction isolation behaves
- What happens under concurrent requests
- Why unnecessary React re-renders hurt performance
- How system design trade-offs affect latency and throughput

Setting up PostgreSQL, Redis, Docker, datasets, benchmarking tools, and profiling environments is also a barrier for beginners.

This platform removes all setup complexity across multiple engineering domains.

---

# 3. Target Users

Primary

- Backend Developers
- Fullstack Developers
- Computer Science Students

Secondary

- Frontend Developers interested in performance
- Interview preparation
- Technical educators

---

# 4. Product Goals

Users should understand engineering concepts through visual experiments across Tracks:

**Database Track**

✓ Indexes

✓ Query Optimization

✓ Execution Plans

✓ Transactions

✓ Isolation Levels

✓ Deadlocks

✓ Cursor Pagination

✓ Offset Pagination

✓ PostgreSQL internals

**Caching & Performance Track**

✓ Redis Cache

✓ Batch Processing

✓ Load Testing

**Future Tracks**

✓ React Rendering (memoization, virtualization, profiler)

✓ System Design (load balancing, consistency, scaling)

✓ Distributed Systems (Kafka, event-driven, sagas)

✓ Browser Performance (layout, paint, composite)

---

# 5. Non Goals

This platform is NOT

- SQL Certification
- LeetCode clone
- PostgreSQL documentation
- Database administration tool
- A single-topic tutorial site

---

# 6. Core Principles

Everything should be visual.

Everything should be interactive.

Users should learn by experimenting.

No installation required.

Every optimization must have measurable impact.

Tracks are independently extensible without changing the core experiment lifecycle.

---

# 7. User Journey

User opens website

↓

Browses Tracks

↓

Chooses a Lab within a Track

↓

Reads learning objective

↓

Runs experiment

↓

Observes metrics

↓

Changes configuration

↓

Runs again

↓

Compares results

↓

Completes quiz

↓

Moves to next lab

---

# 8. MVP Scope

MVP ships **Track 1: Database / SQL** with the following Labs:

## Lab 1

Index Playground

---

## Lab 2

EXPLAIN ANALYZE

---

## Lab 3

OFFSET vs Cursor

---

## Lab 4

Transactions

---

## Lab 5

Isolation Levels

---

## Lab 6

Redis Cache

---

## Lab 7

Batch Processing

---

## Lab 8

Load Testing

---

Future Tracks (React Rendering, System Design, etc.) are planned but not in MVP scope.

---

# 9. Learning Philosophy

Each lab contains

Explanation

↓

Experiment

↓

Visualization

↓

Benchmark (when applicable)

↓

Summary

↓

Quiz

---

# 10. User Interface

Every lab uses the **Lab Shell** — a consistent four-panel layout. Panel content is determined by the Track.

Left Panel

- Theory

Middle Panel

- **Input Surface** (Track-specific)
  - Database Track → SQL Editor
  - React Rendering Track → Component sandbox
  - System Design Track → Configuration / diagram builder
  - Redis Track → Command / config panel

Right Panel

- Visualization (Track-specific chart kit)

Bottom Panel

- Metrics (Track-specific metric catalog)

---

# 11. Metrics Display

Metrics are defined per Track via the **Metric Contract** (`key`, `label`, `unit`, `value`, `group`).

**Database Track metrics:**

Execution Time

Latency

Rows Scanned

Rows Returned

Index Used

Execution Plan

CPU Time

Memory

Network

Cache Hit

Transactions

Deadlocks

RPS

P95

P99

Throughput

**React Rendering Track metrics (future):**

Render Count

Commit Duration

Component Tree Depth

Memo Hit Rate

**System Design Track metrics (future):**

Request Latency

Throughput

Error Rate

Cache Hit Ratio

---

# 12. Example User Experience

User opens Index Lab (Database Track)

Runs

SELECT \* FROM users
WHERE email='abc@gmail.com'

Result

Execution Time

2430 ms

Rows Scanned

1,000,000

Index

No

Full Table Scan

User clicks

Create Index

Runs again

Execution Time

3 ms

Rows Scanned

1

Index Scan

Difference is visualized.

---

# 13. Benchmark System

Users can benchmark

100 RPS

300 RPS

500 RPS

1000 RPS

5000 RPS

Benchmark duration

10s

30s

60s

Metrics

Latency

P95

P99

RPS

Throughput

Error Rate

---

# 14. Dataset

Users never upload data.

Platform provides datasets per Track.

**Database Track examples:**

Users

Orders

Products

Logs

Payments

Large datasets

100K

1M

10M

Other Tracks may use different data sources (component trees, architecture simulations) instead of relational datasets.

---

# 15. Difficulty Levels

Beginner

Intermediate

Advanced

Expert

---

# 16. Progress Tracking

Completed Labs

Quiz Score

Achievements

Learning Path (per Track)

Bookmarks

---

# 17. Future Tracks

Database / SQL (MVP)

Redis & Caching

Kafka & Event-Driven

RabbitMQ

MongoDB

ElasticSearch

Docker

Linux Performance

Browser Rendering

React Rendering

System Design

---

# 18. Success Metrics

Average session >15 minutes

Lab completion >60%

Users finish first lab <10 minutes

Return rate >30%

---

# 19. Technical Constraints

Everything runs inside Docker.

Each experiment is isolated.

Datasets are reset automatically (where applicable).

Maximum execution time per experiment.

Sandbox execution only.

No arbitrary shell execution.

Each Track uses its own Runtime Adapter.

---

# 20. Security

Experiment Sandbox (per Track)

Resource Limiting

Container Isolation

Rate Limiting

Authentication

Audit Logs

---

# 21. Accessibility

Keyboard shortcuts

Dark mode

Responsive

High contrast

Screen reader friendly

---

# 22. Future Premium Features

Custom datasets

Private labs

Save experiments

AI Tutor

Company learning tracks

Leaderboard

Certificates

---

# 23. Out of Scope

Database hosting

Production monitoring

Cloud management

Admin dashboards

---

# 24. Product Vision (Long Term)

Become the interactive platform where developers truly understand engineering concepts — from database performance to React rendering to system design — through experimentation rather than memorization.
