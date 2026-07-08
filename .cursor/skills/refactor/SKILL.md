# Refactor Workflow

Version: 1.0

Status: Active

Owner: Engineering Team

---

# Purpose

This workflow is used to improve the internal structure of existing code without changing its external behavior.

Refactoring should improve

- Readability
- Maintainability
- Testability
- Reusability
- Performance (only if behavior remains unchanged)

Refactoring MUST NOT introduce new features or modify business behavior.

---

# Workflow Overview

```
Identify Code Smell
        ↓
Understand Current Behavior
        ↓
Analyze Impact
        ↓
Create Refactoring Plan
        ↓
Implement Small Changes
        ↓
Verify Behavior
        ↓
Code Review
        ↓
Documentation
        ↓
Done
```

Never refactor code you do not understand.

---

# Step 1 — Understand the Existing Code

Read

- Related Feature Specification
- Existing Implementation
- Existing Tests
- Related Documentation

Understand

- Current responsibilities
- Public interfaces
- Dependencies
- Existing behavior

Never refactor unknown code.

---

# Step 2 — Identify the Motivation

Clearly define why the refactor is needed.

Common reasons

- Large class
- Large function
- Duplicate logic
- Poor naming
- High coupling
- Low cohesion
- Deep nesting
- Dead code
- Difficult testing
- Architecture violation

Avoid "refactoring for style".

---

# Step 3 — Preserve Existing Behavior

Define

Expected behavior

Public APIs

Outputs

Side effects

Refactoring must preserve all observable behavior.

If behavior needs to change

STOP

Use Feature Enhancement or Bug Fix instead.

---

# Step 4 — Impact Analysis

Determine

Which modules depend on this code.

Which APIs may be affected.

Which tests must pass.

Which documentation may require updates.

Prefer localized changes.

---

# Step 5 — Create Refactoring Plan

Break the work into small, independent steps.

Each step should

- Compile successfully
- Pass existing tests
- Be reversible

Avoid large "big bang" refactors.

---

# Complexity Assessment

Before refactoring, estimate

Current Complexity

- Readability
- Maintainability
- Coupling
- Cohesion
- Testability

After refactoring

Explain

- What became simpler?
- What duplication was removed?
- What dependency was eliminated?
- Why is the new design better?

---

# Step 6 — Implement

Implement one small refactoring at a time.

Examples

- Extract Method
- Extract Class
- Rename
- Move Responsibility
- Remove Duplication
- Simplify Conditions
- Reduce Nesting
- Improve Dependency Injection

Avoid changing business logic.

---

# Step 7 — Verify Behavior

Run

- Unit Tests
- Integration Tests
- E2E Tests (if applicable)

Compare behavior before and after.

Expected outputs must remain identical.

---

# Step 8 — Code Review

Review

Architecture

Readability

Maintainability

Naming

Complexity

Dependency Direction

Ensure

No new behavior introduced.

No unnecessary abstraction.

No duplicated logic remains.

---

# Step 9 — Documentation

Update

Developer Documentation

Architecture Notes (if needed)

Comments (only if necessary)

Do not update Product Documentation unless behavior changes.

---

# Step 10 — Complete Refactoring

Mark complete only when

✓ Behavior unchanged

✓ Tests passing

✓ Code simpler

✓ Documentation updated

✓ Review approved

---

# Refactoring Principles

Prefer

- Composition over inheritance
- Small functions
- Explicit names
- Single Responsibility
- Dependency inversion
- Reusable abstractions

Avoid

- Premature abstraction
- Over-engineering
- Unnecessary design patterns
- Large rewrites

---

# AI Agent Rules

AI MUST

Understand existing code before modifying it.

Keep changes incremental.

Preserve external behavior.

Reuse existing abstractions.

Never rewrite entire modules without justification.

Never combine refactoring with feature development.

Explain why each refactoring improves the code.

---

# Human Review Checklist

Ask

Why is this refactor needed?

Does it improve maintainability?

Does it reduce complexity?

Does it preserve behavior?

Would a new developer understand the code more easily?

Is the architecture cleaner after this change?

---

# Definition of Done

A Refactor is complete only when

✓ Existing behavior preserved

✓ Tests passing

✓ Code complexity reduced

✓ Readability improved

✓ Review approved

✓ Documentation updated (if necessary)

---

# Common Refactoring Patterns

Examples

- Extract Method
- Extract Class
- Inline Method
- Rename Variable
- Rename Function
- Replace Conditional with Polymorphism
- Move Method
- Move Responsibility
- Remove Dead Code
- Replace Magic Numbers with Constants

Choose the smallest pattern that solves the problem.

---

# Guiding Principles

Improve the code.

Do not change the product.

Refactor for maintainability, not perfection.

Small continuous improvements are better than large rewrites.

Code should become easier to understand after every refactor.
