# ROADMAP

Version: 1.1

Status: Draft

---

# 1. Vision

Engineering Playground aims to become the most practical platform for learning engineering concepts through experimentation across multiple Tracks.

Learning should happen by observing system behavior instead of memorizing theory.

---

# 2. Product Evolution

Phase 1

Track: Database / SQL

↓

Phase 2

Track: Caching & Concurrency (Redis, Transactions)

↓

Phase 3

Track: Distributed Systems (Kafka, Event-Driven)

↓

Phase 4

Track: Frontend Performance (React Rendering, Browser)

↓

Phase 5

Track: Production Engineering (Docker, Observability, Scaling)

↓

Phase 6

Track: System Design

---

# 3. Release Strategy

MVP

↓

Beta

↓

Public

↓

Premium

↓

Enterprise

---

# 4. MVP Goals

A user should be able to

✓ Login

✓ Browse Database Track labs

✓ Run SQL experiments

✓ Reset Dataset

✓ View Explain Analyze

✓ Compare Query Performance

✓ Benchmark Queries

without installing PostgreSQL.

---

# 5. MVP Features

Authentication

Platform

Track Browser

Lab Browser

Index Lab

Offset vs Cursor Lab

EXPLAIN ANALYZE

Benchmark

Progress Tracking

Quiz

---

# 6. Phase 1

Track

Database / SQL

Epics

Authentication

Platform Foundation

Runtime Adapters (PostgreSQL)

Learning System

Index Lab

EXPLAIN Lab

Offset vs Cursor

Benchmark

---

## Authentication

Features

Login

Register

JWT

Refresh Token

Profile

Progress

---

## Platform Foundation

Features

Landing Page

Track Browser

Lab Browser

Search

Categories

Difficulty

Bookmarks

---

## Runtime Adapters

Features

PostgreSQL Adapter

Dataset Loader

Dataset Reset

Experiment Runner

SQL Sandbox

Metrics Pipeline

---

## Learning System

Features

Theory

Interactive Experiment

Visualization

Quiz

Progress

---

## Index Lab

Learning Goal

Understand B-Tree Index

Features

Run SQL

Create Index

Drop Index

Explain Analyze

Benchmark

Visualization

---

## Explain Analyze Lab

Learning Goal

Understand Query Planner

Features

Execution Tree

Cost

Rows

Planning Time

Execution Time

---

## Offset vs Cursor

Learning Goal

Understand pagination performance

Features

Offset

Cursor

Benchmark

Comparison

Visualization

---

## Benchmark

Learning Goal

Understand throughput and latency

Features

100 RPS

500 RPS

1000 RPS

5000 RPS

Latency

P95

P99

Chart

---

# 7. Phase 2

Track

Caching & Concurrency

Epics

Redis Track

Transactions

Isolation Levels

Deadlocks

Connection Pool

---

## Redis Track

Categories

Cache Patterns

TTL & Expiration

Stampede Prevention

Labs

Cache Aside

Write Through

Write Behind

Cache Invalidation

TTL

Stampede

Benchmark

Runtime Adapter: Playground Redis

---

## Transaction Lab

Categories

ACID

Locks

Concurrency

Labs

BEGIN

COMMIT

ROLLBACK

Locks

Concurrency

---

## Isolation Lab

Categories

Isolation Levels

Anomalies

Labs

Read Uncommitted

Read Committed

Repeatable Read

Serializable

Dirty Read

Phantom Read

---

## Deadlock Lab

Categories

Deadlock Detection

Recovery

Labs

Lock Ordering

Deadlock Detection

Retry

Visualization

---

# 8. Phase 3

Track

Distributed Systems

Epics

Kafka Track

BullMQ

Outbox Pattern

Event Driven

Sagas

Idempotency

Distributed Cache

---

## Kafka Track

Categories

Messaging

Consumer Groups

Ordering

Labs

Topic

Partition

Offset

Consumer Group

Lag

Ordering

Benchmark

Runtime Adapter: Playground Kafka

---

## BullMQ Track

Categories

Job Processing

Retry & Recovery

Labs

Job

Worker

Retry

Delayed

Priority

Rate Limit

Dead Letter

---

## Event Driven Track

Categories

Pub/Sub

Consistency

Labs

Publish

Subscribe

Eventually Consistent

Events

Handlers

---

# 9. Phase 4

Track

Frontend Performance

Epics

React Rendering Track

Browser Rendering Track

Bundle Optimization

Network Optimization

---

## React Rendering Track

Categories

Re-render Optimization

Memoization

Virtualization

Labs

Render Count

React.memo

useMemo

useCallback

Virtualization

Profiler

Runtime Adapter: Headless React sandbox

Input Surface: Component sandbox

---

## Browser Rendering Track

Categories

Rendering Pipeline

GPU

Labs

Layout

Paint

Composite

Reflow

Repaint

GPU

Runtime Adapter: Browser profiling sandbox

---

## Bundle Track

Categories

Code Splitting

Tree Shaking

Labs

Lazy Loading

Dynamic Import

Tree Shaking

Chunk

Route Splitting

---

# 10. Phase 5

Track

Production Engineering

Epics

Docker Track

Linux Track

Observability Track

CI/CD

Scaling

Monitoring

---

## Docker Track

Categories

Containers

Networking

Labs

Volumes

Network

Container

Compose

Image

---

## Observability Track

Categories

Metrics

Logging

Tracing

Labs

Prometheus

Grafana

Loki

Tracing

Logging

Metrics

---

## Scaling Track

Categories

Horizontal Scaling

Resilience

Labs

Horizontal Scaling

Load Balancer

Rate Limiting

Circuit Breaker

---

# 11. Phase 6

Track

System Design

Epics

Load Balancing

Caching Strategies

Consistency Models

CAP Theorem

Database Sharding

API Design

---

## System Design Track

Categories

Scalability

Consistency

Availability

Labs

Load Balancing

Caching Layers

Consistency Trade-offs

CAP Theorem

Sharding

API Rate Limiting

Runtime Adapter: Simulation engine

Input Surface: Architecture diagram builder

---

# 12. Future Features

AI Tutor

Track Recommendation

Lab Recommendation

Custom Dataset

Private Workspace

Company Learning Track

Certificates

Leaderboard

Interview Mode

---

# 13. Spec Generation Rule

Every Epic must produce one or more Specs.

Every Spec should generate

Requirements

↓

Design

↓

Tasks

↓

Implementation

↓

Tests

↓

Documentation

---

# 14. Completion Criteria

A Phase is completed when

All Labs in the Track implemented

Runtime Adapter verified

Documentation complete

Tests passing

Performance verified

Ready for next Phase

---

# 15. Success Metrics

MVP

8 Labs (Database Track)

Beta

20 Labs (across 2 Tracks)

Public

40 Labs (across 4 Tracks)

Long Term

100+ Labs (across all Tracks)

---

# 16. Guiding Principle

Never add a Lab unless it teaches something measurable.

Every optimization should have visible metrics.

Every Lab should answer one engineering question.

Learning through experimentation always comes before theory.

Every new Track requires only a Runtime Adapter, Input Surface, Metric Catalog, and Visualization Kit — the experiment lifecycle stays the same.
