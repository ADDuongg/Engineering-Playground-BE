# API Contract Generation Workflow

Version: 1.0

Status: Active

Owner: Engineering Team

---

# Purpose

This workflow generates the API contract for a Feature after its design has been completed.

The API Contract acts as the shared agreement between Backend and Frontend before implementation begins.

This workflow does NOT implement any code.

---

# Workflow Overview

Design
↓
Extract Public Interfaces
↓
Define API Contract
↓
Review
↓
Publish api.md

---

# Prerequisites

The following documents MUST already exist

- requirements.md
- design.md

Do NOT generate an API Contract directly from requirements.

The design must be finalized first.

---

# Step 1 — Read Existing Specification

Read

- requirements.md
- design.md

Understand

- Feature responsibilities
- Public interfaces
- Data flow
- Expected behavior

---

# Step 2 — Identify Public APIs

Identify every public interaction.

Examples

REST API

WebSocket

SSE

Internal Service API

CLI

Background Jobs

Only include public contracts.

Do NOT document internal implementation.

---

# Step 3 — Generate api.md

Create

api.md

The document should include

- Overview
- Endpoints
- Request
- Response
- Error Responses
- Authentication
- Validation Rules
- Business Rules

The API Contract should describe WHAT the API does.

Never describe HOW it is implemented.

---

# Step 4 — Review

Verify

Every endpoint has

- Purpose
- Request
- Response
- Error cases

Verify

Names are consistent.

HTTP status codes are appropriate.

No implementation details leaked.

---

# Step 5 — Publish

Save

api.md

inside the current Feature specification folder.

Example

specs/

001-dataset-loader/

    api.md

---

# AI Agent Rules

AI MUST

Read requirements.md first.

Read design.md second.

Infer the public contract.

Avoid implementation details.

Do not generate backend code.

Do not generate frontend code.

The output is documentation only.

---

# Human Review Checklist

Ask

Can Backend implement directly from this document?

Can Frontend build UI without asking Backend?

Are all request and response models clear?

Would another engineer understand the API without reading the source code?

---

# Definition of Done

The API Contract is complete when

✓ Every public endpoint is documented

✓ Requests are defined

✓ Responses are defined

✓ Error cases are defined

✓ Authentication requirements are documented

✓ No implementation details are included

---

# Guiding Principles

API Contracts are the communication layer between Backend and Frontend.

Backend implements the contract.

Frontend consumes the contract.

Neither side should depend on the other's implementation.
