# Feature Specification: Quiz Admin CRUD

**Feature Branch**: `023-quiz-admin-crud`

**Created**: 2026-07-12

**Status**: Review

**Input**: User description: "Let admins manage per-lab quiz definitions (questions, options, correct answers, ordering) without new migrations for each lab. Deliverables: Admin APIs to create/update/delete quiz, questions, and options for a lab; Correct-answer flags writable only on admin APIs; never returned on learner definition APIs; Reorder questions/options; validate exactly one correct option per single-select question; Existing submit/grade/progress gating behavior unchanged."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-12

- Q: When does quiz-gating start for a Lab? → A: Gate as soon as the quiz shell exists (even with zero questions); empty-quiz submit is rejected
- Q: Delete quiz when learners already have attempts? → A: Allow hard delete; cascade/remove dependent attempt records; Lab becomes non-gated
- Q: After quiz delete, what happens to existing lab completions? → A: Keep existing lab completion records; only remove quiz + attempts; Lab becomes non-gated going forward
- Q: How must admins create a question’s options? → A: Create question only with options inline in the same operation (≥2 options, exactly one correct)
- Q: How do admins change options after a question exists? → A: After create, support granular option create/update/delete (plus reorder); question update may change prompt/order without replacing all options

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates and Updates a Lab Quiz Shell (Priority: P1)

An authenticated platform admin creates a quiz for an existing Lab (or updates its title), establishing that the Lab is quiz-gated. At most one quiz exists per Lab. After create, operators can inspect the quiz without redeploying seed migrations.

**Why this priority**: Quiz existence is the gate for progress completion. Without admin create/update of the quiz shell, every new lab quiz still requires engineer-owned seeds.

**Independent Test**: Sign in as admin, create a quiz for an existing Lab with an optional title, list/get it, update the title, and verify a second create for the same Lab is rejected.

**Acceptance Scenarios**:

1. **Given** an existing Lab and a signed-in admin, **When** they create a quiz with an optional title, **Then** the quiz is persisted on Platform storage scoped to that Lab and returned in the admin response (including correct-answer metadata when questions exist later).
2. **Given** an admin just created a quiz shell with zero questions, **When** a learner attempts Progress Tracking self-complete for that Lab, **Then** completion is rejected because the Lab is quiz-gated; learner submit of the empty quiz is rejected with a clear validation error.
3. **Given** a Lab that already has a quiz, **When** an admin attempts to create another quiz for that Lab, **Then** the request fails with a clear conflict and no duplicate quiz is created.
4. **Given** an existing quiz, **When** an admin updates its title (including clearing title to empty/null where supported), **Then** subsequent admin and learner quiz reads reflect the updated title.
5. **Given** a Lab does not exist, **When** an admin attempts to create a quiz for it, **Then** the request fails with a clear not-found response and no quiz is created.
6. **Given** a non-admin authenticated user, **When** they attempt quiz create/update via admin operations, **Then** the request is forbidden and no change occurs.
7. **Given** an unauthenticated caller, **When** they attempt any quiz admin operation, **Then** the request is rejected as unauthorized.

---

### User Story 2 - Admin Manages Questions and Options (Priority: P1)

An admin adds, updates, and deletes single-select questions under a Lab’s quiz. Question create includes options inline. After create, admins manage options granularly (create/update/delete individual options, plus reorder) and may update a question’s prompt/order without replacing the full option set. Admin reads always include correct-answer flags so operators can verify the answer key. Learner quiz-definition reads continue to omit correct-answer flags.

**Why this priority**: Authoring questions and the answer key is the core content-ops workflow that unblocks Explain / Offset labs without per-lab migrations.

**Independent Test**: Create a quiz, add two questions with options (exactly one correct each), update a prompt, add/update/delete an option on one question, and verify admin detail shows the answer key while a learner definition request for the same Lab never includes correct flags.

**Acceptance Scenarios**:

1. **Given** a Lab with a quiz and a signed-in admin, **When** they create a single-select question with prompt, order, and at least two options inline in the same operation of which exactly one is marked correct, **Then** the question and options are persisted and returned with correct flags on the admin response.
2. **Given** an admin attempts to create a question without inline options (or with fewer than two), **When** the create is submitted, **Then** the request is rejected with a clear validation error and no question is created.
3. **Given** an existing question, **When** an admin updates prompt and/or display order without sending a full option replacement, **Then** subsequent admin reads reflect the prompt/order change and existing options remain.
4. **Given** an existing question, **When** an admin creates, updates, or deletes an individual option (and the question still ends with ≥2 options and exactly one correct), **Then** admin reads reflect the change and learner definition still omits correct flags.
5. **Given** an existing question, **When** an admin deletes it, **Then** it and its options no longer appear in admin or learner quiz definition for that Lab.
6. **Given** an option create/update/delete that would leave zero or more than one correct option, or fewer than two options, **When** it is submitted, **Then** the request is rejected with a clear validation error and the previous valid answer key is unchanged.
7. **Given** a non-admin caller, **When** they attempt question/option admin writes, **Then** access is denied with no side effects.

---

### User Story 3 - Admin Reorders Questions and Options (Priority: P1)

An admin reorders questions within a quiz and options within a question so the learner-facing presentation order matches the intended pedagogy without recreating content.

**Why this priority**: Content ops routinely adjusts ordering; without reorder, operators must delete/recreate or rely on fragile manual order updates.

**Independent Test**: Create a quiz with multiple questions and options, submit reorder payloads with the exact set of identities in the new order, and verify admin list and learner definition return that order.

**Acceptance Scenarios**:

1. **Given** a quiz with N questions, **When** an admin submits a reorder listing each question identity exactly once in the desired order, **Then** questions are returned in that order (display order 1..N) on admin and learner definition reads.
2. **Given** a question with M options, **When** an admin submits a reorder listing each option identity exactly once, **Then** options appear in that order on admin and learner definition reads.
3. **Given** a reorder that omits an identity, duplicates one, or includes an unknown identity, **When** it is submitted, **Then** the request fails validation and the previous order is unchanged.
4. **Given** a non-admin caller, **When** they attempt reorder, **Then** the request is forbidden.

---

### User Story 4 - Admin Deletes a Quiz; Learner Flows Stay Intact (Priority: P1)

An admin can delete an entire quiz for a Lab (for example before republishing). After deletion, the Lab is no longer quiz-gated: learner definition returns not-found for that Lab’s quiz, and Progress Tracking self-complete works again for that Lab. Existing submit/grade/best-score behavior for Labs that still have quizzes is unchanged.

**Why this priority**: Operators need a way to remove a mistaken or obsolete quiz without a migration; gating semantics must stay consistent with Quiz Engine rules.

**Independent Test**: Delete a quiz for a Lab that previously had one; verify learner quiz definition is not-found, self-complete succeeds (no quiz gate), and another Lab that still has a quiz continues to grade and gate as before.

**Acceptance Scenarios**:

1. **Given** a Lab with a quiz, **When** an admin deletes the quiz, **Then** admin get/list for that Lab’s quiz returns not-found and learner definition for that Lab returns not-found (no quiz).
2. **Given** a Lab with a quiz that already has learner attempts, **When** an admin deletes the quiz, **Then** the quiz and its dependent attempt records are removed, the Lab is no longer quiz-gated, prior attempt history for that quiz is not retained, and any existing lab completion records for that Lab remain unchanged.
3. **Given** the quiz was deleted, **When** a learner uses Progress Tracking self-complete for that Lab, **Then** completion is allowed per labs-without-quiz rules (Quiz Engine FR-010); learners who already completed keep their completion.
4. **Given** other Labs still have quizzes, **When** learners fetch/submit those quizzes, **Then** definition hiding of correct answers, grading, best-score, and progress gating behave exactly as before this feature.
5. **Given** a non-admin caller, **When** they attempt quiz delete, **Then** the request is forbidden.

---

### Edge Cases

- Creating questions before a quiz shell exists for the Lab → clear not-found / precondition error.
- Updating or deleting a question/option that does not belong to the targeted Lab’s quiz → not-found; no cross-lab mutation.
- Changing the answer key after learners have already passed → prior attempts and lab completion remain; new submissions grade against the updated key.
- Deleting a quiz that has historical learner attempts → hard delete is allowed; quiz and dependent attempt records are removed (cascade); Lab is no longer quiz-gated; attempt history for that quiz is not retained; existing lab completion records for that Lab are kept (not revoked).
- Empty quiz (shell with zero questions) → allowed for authoring; Lab is quiz-gated immediately; learner definition may return an empty question list; submit of an empty quiz is rejected with a clear validation error; self-complete remains blocked until the quiz is deleted or the learner later passes a non-empty quiz.
- Question types other than single-select → out of scope; reject unknown types.
- Playground dataset reset MUST NOT affect quiz definitions or admin writes (Platform data only).
- Concurrent admin reorder/update → last successful write wins; invalid partial reorder never leaves a torn order set.
- Deleting or un-marking options such that a question would have fewer than two options or not exactly one correct → rejected; previous valid state retained.
- Lab in `coming-soon` → admin may still author quizzes; learner startability rules remain those of Progress / Quiz Engine (not relaxed by this feature).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authenticated admins to create at most one quiz per existing Lab, with an optional title, on Platform storage.
- **FR-001a**: System MUST treat a Lab as quiz-gated as soon as its quiz shell exists (including zero questions); empty-quiz submit MUST be rejected; Progress Tracking self-complete MUST remain blocked until the quiz is deleted or a passing attempt exists for a gradeable quiz.
- **FR-002**: System MUST allow authenticated admins to update quiz title and to delete the quiz for a Lab.
- **FR-003**: System MUST allow authenticated admins to create, update, and delete single-select questions for a Lab’s quiz. Question create MUST include options inline in the same operation (≥2 options, exactly one correct); creating a question without valid inline options MUST be rejected. Question update MUST allow changing prompt and/or display order without requiring a full option replacement.
- **FR-003a**: After a question exists, System MUST allow authenticated admins to create, update, and delete individual options (including correct flag) and to reorder options; every resulting question state MUST still have ≥2 options and exactly one correct option, or the write MUST be rejected with the previous valid answer key unchanged.
- **FR-004**: System MUST validate that every single-select question has at least two options and exactly one option marked correct on question create and on any option create/update/delete; invalid payloads MUST be rejected without persisting an inconsistent answer key.
- **FR-005**: System MUST allow authenticated admins to reorder questions within a quiz and options within a question via an explicit ordered list of identities covering the full current set.
- **FR-006**: System MUST expose admin read (list/get) of quiz definitions including correct-answer flags for operator verification.
- **FR-007**: System MUST NEVER include correct-answer flags (or equivalent scoring keys) on learner quiz-definition responses; only admin surfaces may expose them.
- **FR-008**: System MUST reject non-admin and unauthenticated callers on all quiz admin operations without side effects.
- **FR-009**: System MUST leave existing learner submit, grade, best-score, unlimited-retake, and progress-gating behavior unchanged for Labs that have a quiz.
- **FR-010**: System MUST treat quiz deletion as a hard delete that removes the quiz and dependent attempt records, removing quiz-gating for that Lab (learner definition not-found; self-complete allowed again), consistent with Quiz Engine rules for labs without a quiz. Soft-delete / archive is out of scope. System MUST NOT revoke or delete existing lab completion records for that Lab when the quiz is deleted.
- **FR-011**: System MUST NOT write to playground runtime storage for any quiz admin operation.
- **FR-012**: System MUST reject unknown question types; MVP remains single-select only.

### Key Entities

- **Quiz**: One per Lab; optional title; existence alone (even with zero questions) means the Lab is quiz-gated.
- **Quiz Question**: Belongs to a Quiz; prompt; type (single-select); display order.
- **Quiz Option**: Belongs to a Question; label; display order; correct flag (admin-only on read).
- **Quiz Attempt**: Existing learner attempt records; not authored by this feature; hard-deleted with the quiz (cascade); not retained after quiz delete.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can author a complete single-select quiz (shell + ≥2 questions with valid options and answer key) for an existing Lab and verify it via admin read without a new content migration.
- **SC-002**: After an admin creates a quiz with valid questions, a learner can fetch the definition without seeing which options are correct, submit answers, and receive the same pass/fail semantics as today (100% to pass).
- **SC-003**: 100% of non-admin attempts against quiz admin operations are denied in automated checks.
- **SC-004**: Reordering questions and options is reflected on the next learner definition read without recreating questions.
- **SC-005**: Deleting a quiz restores non-gated self-complete for that Lab, while other Labs’ quizzes continue to gate and grade correctly.

## Assumptions

- Admin AuthZ (`Role.ADMIN` on admin surfaces) is already available and reused.
- Quiz Engine learner APIs, grading rules (100% pass), and progress gating already exist and are not redesigned.
- Track & Lab Admin CRUD exists so Labs can be registered before quiz authoring.
- MVP question format remains single-select multiple choice only (aligned with Quiz Engine).
- One quiz per Lab (unique Lab association) is the product rule; multi-quiz-per-lab is out of scope.
- Granular admin operations (quiz shell, questions, options, reorder) are preferred over a single replace-entire-quiz payload for MVP, matching other Admin / Content Ops features; question create always includes options inline; afterward options are managed via granular create/update/delete (not full replace-only).
- Changing the answer key does not revoke prior lab completions; historical attempts are not re-graded.
- Hard delete of a quiz is required behavior (not optional): cascade removes dependent attempts; soft-delete / archive of quizzes is out of scope for MVP; lab completions are preserved across quiz delete.
- FE admin UI is out of scope; this feature delivers backend admin capabilities and contracts only.
- Seeded Index Playground quiz remains valid initial content; admins may edit or replace it after this feature ships.
