# Performance Optimization Workflow

Version: 1.0

Status: Active

Owner: Engineering Team

---

# Purpose

This workflow is used to improve the performance of an existing system while preserving its functional behavior.

Optimization should improve one or more measurable metrics, such as

- Latency
- Throughput
- CPU Usage
- Memory Usage
- Disk I/O
- Network Usage
- Database Performance

Optimization MUST be driven by evidence, not assumptions.

---

# Workflow Overview

```
Identify Performance Problem
            ↓
Measure Baseline
            ↓
Root Cause Analysis
            ↓
Design Optimization
            ↓
Implement
            ↓
Measure Again
            ↓
Compare Results
            ↓
Review
            ↓
Done
```

Never optimize code without first measuring its current performance.

---

# Step 1 — Understand the Performance Problem

Define

Expected Performance

Current Performance

Business Impact

Examples

Slow SQL

Slow API

High CPU

High Memory

Long Startup Time

Slow Rendering

Queue Backlog

Database Lock Contention

---

# Step 2 — Measure Baseline

Collect measurable data before making any changes.

Examples

API Response Time

Average Latency

P95

P99

Requests Per Second

Execution Time

Rows Scanned

CPU Usage

Memory Usage

Cache Hit Rate

Benchmark Results

Save all baseline metrics.

Never optimize without baseline measurements.

---

# Step 3 — Root Cause Analysis

Identify the actual bottleneck.

Possible causes

Database

Network

Rendering

Business Logic

Concurrency

Cache

Algorithm

Memory Allocation

Disk I/O

Configuration

Infrastructure

Never optimize the symptom.

Optimize the bottleneck.

---

# Step 4 — Design the Optimization

Define

Current approach

Proposed approach

Expected improvement

Potential risks

Examples

Add Index

Reduce Database Calls

Batch Queries

Cache Results

Optimize Algorithm

Parallel Processing

Lazy Loading

Streaming

Connection Pool Tuning

Avoid unnecessary optimization.

---

# Step 5 — Estimate Impact

Estimate

Expected Latency Improvement

Expected Throughput Improvement

Expected Resource Reduction

Trade-offs

Readability

Maintainability

Memory

Complexity

Every optimization should have a measurable objective.

---

# Step 6 — Implement

Implement only the optimization required.

Avoid unrelated refactoring.

Avoid feature changes.

Keep changes isolated.

---

# Step 7 — Measure Again

Repeat the exact same benchmark.

Collect the same metrics.

Examples

Latency

P95

P99

Execution Time

Rows Scanned

CPU

Memory

Cache Hit Rate

Throughput

Ensure measurements are comparable.

---

# Step 8 — Compare Results

Compare

Before

↓

After

Document

Improvement

Regression

Unexpected Effects

If no measurable improvement exists

Consider reverting the optimization.

---

# Step 9 — Code Review

Review

Correctness

Performance

Readability

Maintainability

Trade-offs

Architecture

Confirm

Behavior unchanged.

Performance improved.

Complexity justified.

---

# Step 10 — Documentation

Update

Performance Notes

Benchmark Results

Architecture Notes (if applicable)

Optimization Rationale

Document

Before

After

Trade-offs

---

# Step 11 — Complete Optimization

Optimization is complete only when

✓ Performance improvement measured

✓ Functional behavior preserved

✓ Tests passing

✓ Benchmark documented

✓ Review approved

✓ Documentation updated

---

# Performance Metrics

Measure when applicable

API

- Average Response Time
- P95
- P99
- RPS

Database

- Execution Time
- Rows Scanned
- Index Usage
- Buffer Hits

Backend

- CPU
- Memory
- GC Activity

Frontend

- Render Time
- FPS
- Bundle Size

Infrastructure

- Queue Length
- Worker Throughput
- Connection Pool Usage

---

# AI Agent Rules

AI MUST

Measure before optimizing.

Explain the bottleneck.

Explain why the proposed optimization addresses the bottleneck.

Avoid premature optimization.

Avoid changing functionality.

Avoid introducing unnecessary complexity.

Benchmark after every optimization.

---

# Human Review Checklist

Ask

What is the bottleneck?

How was it measured?

What metric improved?

Is the improvement statistically meaningful?

Did any metric become worse?

Is the added complexity justified?

Would this optimization still be valuable in six months?

---

# Definition of Done

An Optimization is complete only when

✓ Baseline measured

✓ Root cause identified

✓ Optimization implemented

✓ Benchmark repeated

✓ Measurable improvement demonstrated

✓ No functional regression

✓ Documentation updated

✓ Review approved

---

# Common Optimization Techniques

Database

- Add Index
- Remove N+1 Queries
- Batch Operations
- Cursor Pagination
- Query Rewrite

Backend

- Caching
- Async Processing
- Connection Pool Tuning
- Reduce Serialization

Frontend

- Memoization
- Virtualization
- Code Splitting
- Lazy Loading

Infrastructure

- Horizontal Scaling
- Load Balancing
- Queue Optimization
- Resource Tuning

Choose the simplest technique that solves the bottleneck.

---

# Guiding Principles

Measure before optimizing.

Optimize the bottleneck.

Preserve correctness.

Prefer simple optimizations over complex ones.

Every optimization should have measurable evidence.

If performance cannot be measured, it cannot be optimized.
