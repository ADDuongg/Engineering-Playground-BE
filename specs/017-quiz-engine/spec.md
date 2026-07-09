# Feature Specification: Quiz Engine

**Feature Branch**: `017-quiz-engine`

**Created**: 2026-07-09

**Status**: Done

**Input**: User description: "Validate learning after experiments with per-lab quizzes (DOMAIN §Lab, PRD §9). Deliverables: quiz definition per lab; submit answers and score calculation; store quiz scores on Platform DB; gate progress updates on quiz completion where required."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-09

- Q: Pass threshold for a lab quiz? → A: 100% correct required (option A).
- Q: Retake policy and which score is shown? → A: Unlimited retakes; keep **best** score (option A).
- Q: Question format for MVP? → A: Single-select multiple choice only (option A).
- Q: When is a lab quiz-gated? → A: Any lab that has a quiz definition is quiz-gated; labs without a quiz keep Progress Tracking self-complete.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fetch Quiz Definition for a Lab (Priority: P1)

An authenticated learner finishes a lab’s experiments and opens the quiz step. The platform returns that lab’s quiz definition (questions and answer options) so the FE can render the quiz without exposing which options are correct.

**Why this priority**: Without a readable quiz definition, submit/score flows cannot be exercised. This is the core read path for learning validation.

**Independent Test**: Seed a quiz for a catalog lab; authenticate; request the quiz for that lab slug; verify questions and options are returned without correct-answer flags.

**Acceptance Scenarios**:

1. **Given** an authenticated user and a lab that has a seeded quiz, **When** they request the quiz for that lab, **Then** they receive the quiz title (if any), ordered questions, and ordered answer options suitable for display.
2. **Given** a successful quiz-definition response, **When** the client inspects the payload, **Then** correct-answer indicators and scoring keys are not included.
3. **Given** a lab that exists but has no quiz defined, **When** the quiz is requested, **Then** the client receives a clear not-found response distinct from an unknown lab where practical.
4. **Given** an unauthenticated caller, **When** they request a quiz definition, **Then** the request is rejected as unauthorized.
5. **Given** a lab slug that is not in the catalog, **When** the quiz is requested, **Then** the client receives a clear not-found response.

---

### User Story 2 - Submit Answers and Receive Score (Priority: P1)

An authenticated learner submits answers for a lab quiz. The platform grades the submission against the stored answer key, persists the attempt/score on the Platform database, and returns the score result (and enough feedback for learning without leaking future answer keys unnecessarily).

**Why this priority**: Score calculation and durable storage are the core write path; progress gating depends on a recorded pass/fail outcome.

**Independent Test**: Seed a quiz with known correct answers; submit a full answer set; verify persisted score and response match expected grade; confirm data survives playground reset.

**Acceptance Scenarios**:

1. **Given** an authenticated user and a lab with a quiz, **When** they submit a complete set of answers, **Then** the system returns a score summary (correct count, total questions, percent, and pass/fail) and stores the attempt on Platform DB.
2. **Given** a submission with all answers correct (100%), **When** grading completes, **Then** the attempt is marked passed and a quiz-completed domain event is emitted (user, track, lab, score summary).
3. **Given** a submission with any incorrect answer, **When** grading completes, **Then** the attempt is stored as not passed, no lab-completion side effect occurs from this feature’s pass path, and the response clearly indicates failure.
4. **Given** a submission missing answers for one or more questions, **When** it is submitted, **Then** the system rejects it with a clear validation error (incomplete submission).
5. **Given** an unauthenticated caller, **When** they submit answers, **Then** the request is rejected as unauthorized.
6. **Given** a user who already has attempts, **When** they submit again, **Then** a new attempt is stored (unlimited retakes) and the result read API continues to expose the **best** score across attempts.

---

### User Story 3 - Gate Lab Progress on Quiz Pass (Priority: P1)

For labs that have a quiz, learning progress (lab completion) updates only after the learner passes the quiz (100% correct). This restricts the Progress Tracking self-complete path for those labs, matching SYSTEM_DESIGN (“progress updates after quiz completed”) and the Progress Tracking deferral that Quiz Engine may gate completion.

**Why this priority**: BACKLOG explicitly requires gating progress on quiz completion where required; without this, quizzes do not close the learning loop.

**Independent Test**: Attempt self-complete on a lab that has a quiz (expect rejection); pass the quiz; verify lab appears completed in progress APIs and a completion/progress event path is consistent with Progress Tracking.

**Acceptance Scenarios**:

1. **Given** a lab that has a quiz, **When** an authenticated user tries to self-complete via the Progress Tracking complete API without a passing quiz attempt, **Then** completion is rejected with a clear reason that the quiz must be passed.
2. **Given** the same user then submits a passing quiz attempt (100% correct), **When** grading succeeds, **Then** the lab is recorded as completed for that user (idempotent with Progress Tracking’s completion registry) and progress reads reflect completion.
3. **Given** a lab with no quiz, **When** the user uses the existing self-complete API, **Then** completion still works as in Progress Tracking (no regression).
4. **Given** a user who already passed the quiz and completed the lab, **When** they submit the quiz again, **Then** scoring still works (unlimited retakes; best score retained for result reads) and completion remains a single registry record (idempotent).

---

### User Story 4 - Read Own Quiz Results (Priority: P2)

FE needs to show whether the user has already passed a lab’s quiz and their **best** score without re-submitting.

**Why this priority**: Improves catalog/detail UX; secondary to define/submit/gate.

**Independent Test**: Submit a failing then a better/passing attempt; request quiz result for that lab; verify pass flag and score match the best stored attempt.

**Acceptance Scenarios**:

1. **Given** an authenticated user with no attempts for a lab quiz, **When** they request their quiz result, **Then** they receive a clear empty/not-attempted payload (not an error).
2. **Given** an authenticated user with one or more attempts, **When** they request their quiz result, **Then** they receive pass/fail and score summary for the **best** attempt (highest percent; pass if any attempt passed).
3. **Given** an unauthenticated caller, **When** they request quiz results, **Then** the request is rejected as unauthorized.

---

### Edge Cases

- What happens when submitting answers for a lab with no quiz? Clear not-found / no-quiz error.
- What happens when an answer references an unknown question or option id? Validation error; nothing persisted.
- What happens on concurrent submissions for the same user+lab? Each attempt may be stored; completion remains idempotent (one completion record); result read always reflects best score.
- What happens if the user is deleted? Quiz attempts for that user are removed or cascade-deleted (no orphan scores).
- Playground dataset reset must not delete quiz definitions or user quiz scores (Platform DB only).
- Coming-soon Track labs: quiz fetch/submit rejected consistently with Progress Tracking (lab/track not available for learning).
- Partial correct answers: score reflects correct question count and percent; pass requires 100% correct.
- Selecting more than one option for a single-select question: validation error.
- Best-score tie: if two attempts share the same percent, either may be chosen as long as pass/fail and percent are correct; prefer most recent among ties when documented in design.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store quiz definitions per catalog lab on the Platform database (questions, options, correct answer key, display order), separate from playground runtime state.
- **FR-002**: System MUST seed at least one quiz for an MVP catalog lab (e.g. a Database / SQL lab already in the Progress Tracking lab catalog) via migration/seed so APIs are testable before every lab feature ships.
- **FR-003**: System MUST expose an authenticated API to fetch a lab’s quiz definition for display without revealing correct answers.
- **FR-004**: System MUST expose an authenticated API to submit a full set of answers for a lab quiz, grade against the answer key, and return a score summary (correct count, total, percent, pass/fail).
- **FR-005**: System MUST persist quiz attempts/scores on the Platform database, associated with user and lab, and MUST NOT use playground reset to clear them.
- **FR-006**: System MUST mark an attempt as passed only when **100%** of questions are answered correctly; any incorrect answer is a fail.
- **FR-007**: System MUST allow unlimited retakes; each submission creates a new attempt; result reads MUST expose the **best** score across attempts (highest percent; `passed` if any attempt passed).
- **FR-008**: System MUST emit a `QuizCompleted` (or equivalent) domain event on a successful graded submission that passes, including user id, track slug, lab slug, and score summary (SYSTEM_DESIGN §20).
- **FR-009**: For any lab that has a quiz definition, System MUST record lab completion in the Progress Tracking completion registry only after a passing quiz attempt, and MUST reject Progress Tracking self-complete for that lab until passed.
- **FR-010**: For labs without a quiz, System MUST leave Progress Tracking self-complete behavior unchanged.
- **FR-011**: System MUST expose an authenticated API for the current user to read their quiz result status for a lab (not attempted / failed / passed + best score summary).
- **FR-012**: Quiz definition maintenance for MVP MUST be seed/migration-only (no admin quiz CMS/CRUD API in this feature), consistent with lab catalog maintenance.
- **FR-013**: Question format for MVP MUST be **single-select multiple choice only** (exactly one correct option per question; one selected option per answer).
- **FR-014**: System MUST reject unauthenticated quiz definition reads, submissions, and result reads.
- **FR-015**: Backend-only deliverable: APIs and contracts for FE; no quiz UI in this feature.

### Key Entities

- **Quiz**: Platform learning assessment bound to one catalog lab — optional title, ordered questions; pass rule is fixed at 100% for MVP.
- **QuizQuestion**: Prompt text, display order, type `single_select`, ordered options; belongs to one Quiz.
- **QuizOption**: Option text, display order, correctness flag (server-only; never returned on definition read); exactly one correct option per question.
- **QuizAttempt**: User submission for a lab quiz — selected option per question, score summary, pass/fail, attempted-at; belongs to user + lab/quiz; multiple attempts allowed.
- **QuizResultSummary**: Derived read model — not attempted, or best attempt score and pass flag for the current user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a passing submission, a subsequent progress read for that Track shows the lab as completed within 1 second under normal API conditions.
- **SC-002**: 100% of quiz-definition responses in contract tests omit correct-answer fields.
- **SC-003**: Incomplete or invalid answer payloads are rejected with validation errors in 100% of contract tests; no partial attempt row is treated as a pass.
- **SC-004**: Playground dataset reset does not reduce the user’s stored quiz attempt count or remove quiz definitions (verified in integration test).
- **SC-005**: Unauthenticated quiz read/submit/result attempts are rejected in 100% of API contract tests.
- **SC-006**: For a lab with a quiz, self-complete without a passing attempt never creates a completion record (verified in integration test).
- **SC-007**: After multiple attempts with different scores, the result read API returns the highest percent (and passed if any attempt was 100%) in 100% of unit/contract tests.

## Assumptions

- Backend-only: no FE quiz UI; APIs and contracts are the deliverable for the FE team.
- Authentication (JWT) already exists; quiz ownership is always the authenticated user (`sub`).
- Progress Tracking (lab catalog, completion registry, learning path, progress reads, `lab.completed` event) already exists and is the sole completion registry; Quiz Engine integrates with it rather than duplicating completion storage.
- Lab slugs remain globally unique; quiz APIs key by `labSlug`.
- MVP quizzes are authored via seeds/migrations only (like Track Registry and lab catalog).
- Free-text / essay grading, multi-select, and dedicated true/false question types are out of scope for MVP (true/false can be modeled later as two-option single-select if needed).
- Achievements, certificates, leaderboards, and timed exams are out of scope.
- Anonymous / guest quizzes are out of scope.
- Admin CMS for quiz authoring is out of scope for this feature.
- Educational feedback may include which questions were wrong after submit; full answer-key dump on every failed attempt is discouraged but exact feedback shape can be refined in design.
- Quiz-gating is implied by quiz presence: no separate `quizGated` flag for MVP.
