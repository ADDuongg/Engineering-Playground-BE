# Feature Development Workflow

Version: 1.0

Status: Active

Owner: Engineering Team

---

# Purpose

This document defines the standard workflow for developing any new feature in Database Playground.

Every engineer and AI Agent MUST follow this workflow.

This workflow applies to:

- Backend features
- Frontend features
- Playground Runtime
- Labs
- Infrastructure
- Platform features

---

# Workflow Overview

```
Backlog
    ↓
Select Feature
    ↓
Specification
    ↓
Design Review
    ↓
Task Breakdown
    ↓
Implementation
    ↓
Code Review
    ↓
Testing
    ↓
Documentation
    ↓
Done
```

Never skip a stage.

---

# Step 1 — Read Project Context

Before doing anything, read:

- PRD.md
- ROADMAP.md
- BACKLOG.md
- DOMAIN.md
- SYSTEM_DESIGN.md
- ARCHITECTURE.md
- ENGINEERING_GUIDE.md

Goal:

Understand

- product vision
- architecture
- current roadmap
- current backlog
- engineering rules

Do NOT start implementation before reading these documents.

---

# Step 2 — Select Feature

Open

BACKLOG.md

Select the highest priority Feature whose

Status = Todo

and

Dependencies are satisfied.

Never implement multiple Features at the same time.

Output:

Selected Feature

---

# Step 3 — Verify Feature Readiness

Before creating a Spec verify:

✓ Goal is clear

✓ Deliverables are defined

✓ Dependencies completed

✓ Priority assigned

✓ Scope understood

If anything is missing

STOP

Improve BACKLOG first.

---

# Step 4 — Generate Specification

Run

/speckit-specify

Goal

Generate

requirements.md

Only requirements should be created.

Do NOT implement.

---

# Step 5 — Clarify Requirements

Run

/speckit-clarify

Resolve

Ambiguities

Edge cases

Acceptance criteria

Repeat until requirements are complete.

---

# Step 6 — Generate Design

Run

/ speckit-plan

Generate

design.md

Review

Responsibilities

Data Flow

Dependencies

Public Interfaces

Out of Scope

If design violates architecture

Return to previous step.

---

# Step 7 — Review Design

Review

design.md

Questions

Does it follow SYSTEM_DESIGN?

Does it follow ARCHITECTURE?

Does it introduce unnecessary complexity?

Does it duplicate existing functionality?

If not

Revise design.

---

# Step 8 — Generate Tasks

Run

/speckit-tasks

Generate

tasks.md

Tasks should

be small

be independent

be testable

Avoid large implementation tasks.

---

# Step 9 — Review Tasks

Review

Every task

Should have

single responsibility

clear output

clear completion criteria

If tasks are too large

Split them.

---

# Step 10 — Implementation

Run

/speckit-implement

Implement

ONE TASK ONLY.

Never implement multiple unfinished tasks.

Follow

ENGINEERING_GUIDE.md

Respect

ARCHITECTURE.md

---

# Step 11 — Code Review

Verify

Architecture

Naming

Reusability

Performance

Security

No duplicated logic

No dead code

No unnecessary abstraction

---

# Step 12 — Testing

Run

Unit Tests

Integration Tests

E2E Tests (if applicable)

Every task should pass before continuing.

---

# Step 13 — Documentation

Update

Spec

Documentation

Comments (when necessary)

Never let implementation diverge from documentation.

---

# Step 14 — Update Backlog

Update

BACKLOG.md

Status

Todo

↓

Implementing

↓

Review

↓

Done

Link

Spec Folder

Implementation PR

Notes

---

# Step 15 — Merge

Merge only when

✓ Tests pass

✓ Review completed

✓ Documentation updated

✓ Backlog updated

---

# Definition of Done

A Feature is Done only when

- Implementation completed
- Tests passed
- Documentation updated
- Spec synchronized
- Code reviewed
- Backlog updated

---

# AI Agent Rules

AI MUST

Read existing code before writing new code.

Reuse existing modules whenever possible.

Never invent a new architecture.

Never bypass project conventions.

Never modify unrelated Features.

Never skip testing.

Always update documentation.

---

# Human Review Checklist

Before approving a Feature

Ask

Does this Feature solve the intended problem?

Does it introduce unnecessary complexity?

Can another engineer understand it within minutes?

Does it follow project architecture?

Would I merge this into production?

---

# Workflow Summary

```
Read Docs
      ↓
Select Feature
      ↓
Verify Readiness
      ↓
Specify
      ↓
Clarify
      ↓
Plan
      ↓
Review Design
      ↓
Generate Tasks
      ↓
Review Tasks
      ↓
Implement
      ↓
Review
      ↓
Test
      ↓
Documentation
      ↓
Update Backlog
      ↓
Done
```

---

# Guiding Principle

Never write code before understanding the Feature.

Never implement without a Spec.

Never optimize before measuring.

Every Feature should improve the learning experience.

Consistency is more important than speed.
