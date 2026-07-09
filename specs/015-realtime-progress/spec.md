# Feature Specification: Realtime Progress

**Feature Branch**: `015-realtime-progress`

**Created**: 2026-07-09

**Status**: Done

**Input**: User description: "Stream benchmark progress to the UI while long-running load tests execute. Deliver a live progress indicator (phase, elapsed time, current RPS), partial metrics preview during the run, graceful handling of disconnect and completion states, and avoid polling overload on the API (ROADMAP §Benchmark, SYSTEM_DESIGN §Benchmark Runner)."

**Constitution**: Features MUST align with `.specify/memory/constitution.md`
(learning-first UX, platform/playground separation, testable user stories).

## Clarifications

### Session 2026-07-09

- Q: How should learners receive live progress? → A: Push-only live stream for in-run progress; status API used for submit + terminal checks, not as the progress mechanism
- Q: What belongs in the in-run partial metrics preview? → A: Current RPS plus provisional latency and/or error signals when observations exist (still marked provisional)
- Q: Are in-run progress snapshots persisted, or ephemeral only? → A: Ephemeral only — keep latest progress for reconnect; do not persist in-run snapshots as history
- Q: If latest ephemeral progress is missing on reconnect while the job is still running? → A: Seed phase/elapsed from job lifecycle status, resume push stream; RPS/partial metrics wait for next observation
- Q: After a terminal progress signal, how should the lab obtain final metrics? → A: Terminal signal ends the stream only; finals come from status / Benchmark Metrics APIs

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Learner Sees Live Benchmark Progress Without Freezing the Lab (Priority: P1)

A learner starts a multi-second (or longer) load benchmark in a Database Track lab. While the job is queued and running, the lab shows a live progress indicator: current phase, elapsed time, and current achieved request rate. The learner can keep reading theory or editing SQL; the UI stays responsive and does not depend on aggressive status polling that would overload the API.

**Why this priority**: Long-running benchmarks feel broken without visible progress. Live phase/elapsed/RPS feedback is the minimum trust signal that the test is actually running.

**Independent Test**: Start a benchmark with a multi-second duration; verify the learner receives successive progress updates covering phase, elapsed time, and current RPS while the job remains non-terminal — without requiring high-frequency status polling.

**Acceptance Scenarios**:

1. **Given** a learner has submitted a benchmark that is still queued or running, **When** they observe live progress for that job, **Then** they see the current lifecycle phase, elapsed time since the relevant start point, and a current RPS reading when the run has begun producing load.
2. **Given** a benchmark transitions from queued to running, **When** progress updates continue, **Then** the phase change is reflected in the live progress stream without the learner manually refreshing the page.
3. **Given** a benchmark is running, **When** the learner continues using the lab UI, **Then** progress updates arrive via the push live stream without blocking lab interactions and without using status polling as the progress mechanism.
4. **Given** a learner is not the owner of a benchmark job, **When** they attempt to observe its live progress, **Then** access is denied.

---

### User Story 2 - Learner Previews Partial Metrics While the Run Is In Progress (Priority: P1)

During a running benchmark, the learner sees a backend-owned partial metrics preview (for example provisional latency and error signals alongside current RPS) so they can start forming intuition about load behavior before the job completes. Partial values are clearly distinguished from final Benchmark Metrics results and MUST NOT be treated as chart-ready final aggregates.

**Why this priority**: Partial preview turns waiting time into learning time. Without it, learners only see a spinner until completion, then jump to final charts from Benchmark Metrics.

**Independent Test**: While a benchmark is running, verify the live progress payload includes a partial metrics preview from the backend; after completion, verify final metrics remain the responsibility of Benchmark Metrics and are not replaced by stale partial values.

**Acceptance Scenarios**:

1. **Given** a benchmark is actively running and producing interim observations, **When** the learner receives a progress update, **Then** the update includes current RPS and, when available, provisional latency and/or error signals — all backend-provided with keys, labels, units, and values, and marked provisional.
2. **Given** partial metrics are shown during a run, **When** the lab renders them, **Then** the UI can mark them as in-progress / provisional and MUST NOT compute engineering metrics on the client.
3. **Given** a benchmark is still queued and has not started load generation, **When** progress is observed, **Then** partial metrics may be absent or empty rather than inventing zeros that look like real measurements.
4. **Given** a benchmark completes successfully, **When** the live stream ends with a terminal signal, **Then** the lab obtains final Metric Contract values from status / Benchmark Metrics APIs — not from the progress stream — and those finals supersede any in-run partial preview for charts and history.

---

### User Story 3 - Learner Recovers Gracefully From Disconnect and Completion (Priority: P1)

A learner’s live progress connection drops mid-run (network blip, tab sleep, temporary disconnect). When they reconnect, they resume from the latest known progress for that job rather than a blank or stuck indicator. When the benchmark completes or fails, live progress ends cleanly and the lab transitions to the terminal status path (including final metrics when available) without leaving a dangling “still running” state.

**Why this priority**: Disconnects are common on long runs. Graceful resume and clean completion prevent false “stuck benchmark” experiences and support tickets.

**Independent Test**: Subscribe to progress, disconnect mid-run, reconnect, and verify latest progress is restored; then let the job complete and verify the live stream ends and terminal status/metrics paths take over.

**Acceptance Scenarios**:

1. **Given** a learner loses the live progress connection while a job is still running, **When** they reconnect for the same job, **Then** they receive the latest available progress snapshot (or a status-seeded phase/elapsed snapshot if ephemeral progress was lost) and continue receiving subsequent push updates.
2. **Given** a benchmark reaches completed or failed, **When** the learner is (or reconnects while) observing progress, **Then** they receive a terminal progress signal that ends the live stream (without embedding final Metric Contract values) and the UI switches to status / Benchmark Metrics for finals.
3. **Given** a job already completed before the learner opens live progress, **When** they attempt to subscribe, **Then** they receive a clear terminal state rather than hanging indefinitely waiting for in-run updates.
4. **Given** reconnect or completion handling runs, **When** updates are delivered, **Then** progress remains scoped to the learner’s own job and session — no cross-user leakage.

---

### User Story 4 - Platform Avoids Progress-Induced API Overload (Priority: P2)

Operators need assurance that many concurrent learners watching long benchmarks do not degrade core API availability through chatty status polling. Live progress is delivered in a way that keeps per-learner update cost bounded and does not require aggressive polling of the existing benchmark status endpoint for in-run feedback.

**Why this priority**: Benchmarks already stress playground targets; progress delivery must not also stress the platform control plane.

**Independent Test**: Simulate multiple concurrent learners observing running benchmarks and verify progress delivery stays within bounded update rates while core authenticated API endpoints remain responsive under the test load profile.

**Acceptance Scenarios**:

1. **Given** multiple learners observe running benchmarks concurrently, **When** progress updates are delivered, **Then** each learner receives updates for their own jobs via the push live stream — not by polling the benchmark status API for progress.
2. **Given** a learner’s live progress session is idle or disconnected, **When** the platform cleans up, **Then** it stops sending updates for that observer so resources are not retained indefinitely.
3. **Given** progress updates are emitted for a running job, **When** update frequency is observed under test, **Then** it remains within a bounded rate suitable for UI indicators (not unbounded per-request chatter).

---

### Edge Cases

- What happens when the benchmark fails before producing any load observations? Live progress ends with a failed terminal signal; no success-looking partial metrics remain as the primary result.
- What happens when interim observations are sparse or delayed? Progress still shows phase and elapsed time; partial metrics may lag or be omitted until observations exist — the UI MUST NOT invent values.
- What happens when current RPS is far below the requested tier? Progress reports measured current RPS, not the configured target alone.
- What happens if the learner opens two tabs on the same job? Both may observe progress; completion handling remains consistent; no duplicate job execution is triggered by observing progress.
- What happens if the learner requests progress for a non-benchmark job id? The request is rejected as not found or wrong job type.
- What happens if final Benchmark Metrics collection is still pending after completion? Live progress has already ended with a terminal signal; the lab uses existing Benchmark Metrics pending/unavailable semantics for final charts — this feature does not re-collect final metrics.
- What happens to ephemeral progress after the job is terminal? Latest snapshot may be used briefly for reconnect-after-completion terminal indication, then discarded; it is never promoted to durable metric history.
- What happens if the latest ephemeral progress is missing on reconnect (e.g. process restart) while the job is still running? The system seeds phase and elapsed time from existing job lifecycle status, resumes the push stream, and omits current RPS / partial metrics until the next observation — without using status polling as the ongoing progress mechanism.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide live progress updates for a learner’s own in-flight benchmark job covering at least: lifecycle phase, elapsed time, and current RPS once load generation has started.
- **FR-002**: System MUST deliver in-run progress exclusively via a push live stream; the benchmark status API MAY be used for submit acknowledgment and terminal/lifecycle checks, but MUST NOT be the mechanism for in-run progress UX (no progress-via-polling path in MVP).
- **FR-003**: System MUST include a backend-owned partial metrics preview on in-run updates once load has started: current RPS always when measurable, plus provisional latency and/or error signals when interim observations exist — using stable keys, human-readable labels, units, and numeric values. The full six-metric final Benchmark Metrics set is NOT required mid-run.
- **FR-004**: System MUST clearly distinguish partial/in-progress metrics from final Benchmark Metrics results so labs do not treat provisional values as completed chart history.
- **FR-005**: Frontend MUST NOT derive phase, elapsed time, current RPS, or partial engineering metrics from raw executor output; all progress fields originate from the backend.
- **FR-006**: System MUST deny live progress access for jobs the requester does not own.
- **FR-007**: System MUST support graceful reconnect: after disconnect, a learner can resume observing the same running job from the latest available progress snapshot and continue receiving push updates. If that ephemeral snapshot is missing while the job is still non-terminal, the system MUST seed phase and elapsed time from job lifecycle status, resume the push stream, and MUST NOT invent current RPS or partial metrics until the next observation.
- **FR-008**: System MUST end live progress cleanly when a job reaches completed or failed with a terminal signal that closes the stream and MUST NOT embed final Metric Contract values on that signal; the lab MUST obtain finals from status / Benchmark Metrics APIs.
- **FR-009**: System MUST handle subscribe-after-completion without hanging: learners receive a clear terminal indication for already-finished jobs.
- **FR-010**: System MUST bound progress update frequency per job/observer so concurrent learners cannot create unbounded control-plane load via progress observation.
- **FR-011**: System MUST release observer resources when a learner disconnects or a job becomes terminal so progress delivery does not leak sessions.
- **FR-012**: System MUST NOT invent partial metric values (including zeros that imply measurement) when no interim observations exist yet.
- **FR-013**: System MUST keep live progress scoped to Benchmark Runner jobs; it MUST NOT change final metric persistence, history, or Metric Contract collection owned by Benchmark Metrics.
- **FR-015**: System MUST treat in-run progress as ephemeral: retain at most the latest progress snapshot per job for reconnect/resume, and MUST NOT persist in-run progress ticks or partial metrics as Platform DB history.
- **FR-014**: System MUST emit observability suitable for diagnosing “UI stuck on running” vs “job already failed/completed” without logging full SQL text or raw row payloads.

### Key Entities

- **Benchmark Progress Snapshot**: Ephemeral point-in-time view of an in-flight (or just-terminal) benchmark for UI display — phase, elapsed time, current RPS, optional partial metrics, job identity, and timestamps. Only the latest snapshot is retained for reconnect; not stored as durable history.
- **Partial Metrics Preview**: Backend-normalized provisional values during a run — current RPS plus optional provisional latency and/or error signals; not retained as Benchmark Metrics history.
- **Progress Observation Session**: A learner’s active observation of a specific job’s live progress, including reconnect/resume semantics and cleanup on disconnect or terminal state.
- **Terminal Progress Signal**: Indication that live in-run updates have ended because the job completed or failed; closes the stream and does not carry final Metric Contract values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In integration tests, 100% of running benchmarks under observation expose successive progress updates that include phase and elapsed time, and include current RPS after load generation has started.
- **SC-002**: Learners can reconnect after a forced disconnect mid-run and resume progress for the same job within 3 seconds under nominal test conditions, receiving a latest snapshot then further updates if the job is still running.
- **SC-003**: When a benchmark completes or fails, live progress ends via terminal signal (without final metrics on the stream) and the lab can present terminal status / Benchmark Metrics without remaining in a “running” progress state in 100% of acceptance tests.
- **SC-004**: Partial metrics preview, when present, is backend-provided only — verified by contract audit that the client does not compute engineering metrics for the in-run indicator.
- **SC-005**: Progress observation for concurrent learners uses the push live stream only; acceptance tests demonstrate bounded update delivery and that the status API is not used as the in-run progress mechanism.
- **SC-006**: 100% of unauthorized cross-user progress observation attempts are denied in acceptance tests.

## Assumptions

- Scope is **Benchmark Runner jobs only** (Database Track load tests). Live progress for SQL execution queue jobs, dataset reset, or lab learning-progress tracking is out of scope.
- **Benchmark Runner** already exposes queued → running → completed/failed lifecycle; this feature adds live in-run progress on top of that lifecycle, not a replacement for status retrieval.
- **Benchmark Metrics** remains the source of truth for final chart-ready Metric Contract values and history after successful completion; this feature only provides provisional in-run preview. After terminal signal, labs use status / Benchmark Metrics APIs for finals — the progress stream does not carry or wait for final metrics.
- Partial metrics preview is **current RPS plus provisional latency and/or error signals when observations exist** — catalog-aligned keys/labels/units, always marked provisional. Full six-metric finals remain Benchmark Metrics only.
- Elapsed time for queued jobs measures wait since enqueue (or clearly labeled queue wait); elapsed time for running jobs measures since execution start — labels make the distinction clear to learners.
- Delivery is **push-only live stream** for in-run progress; status API remains for submit + terminal checks only. Exact transport is a design concern; hybrid or polling-based progress is out of MVP scope.
- Authentication and ownership rules match existing Benchmark Runner status access.
- Update cadence defaults to a **UI-friendly bounded rate** (on the order of about once per second unless design chooses otherwise) — precise interval is a planning decision as long as SC-005 holds.
- Missed interim updates during disconnect are acceptable; resume provides the **latest snapshot**, not a full replay of every missed tick.
- In-run progress is **ephemeral only** (latest snapshot for reconnect); no Platform DB persistence of progress ticks or partial metrics as history.
- On reconnect with missing ephemeral progress for a still-running job: **seed phase/elapsed from job lifecycle status**, then resume push stream; RPS/partial metrics appear on the next observation. This one-time seed does not make status polling the progress mechanism.

## Dependencies

- **Benchmark Runner** (Done): Job lifecycle, ownership, and execution that produces in-run observations.
- **Authentication** (Done): Identity for ownership checks on progress observation.
- **Benchmark Metrics** (Done): Final metrics after completion; this feature must hand off cleanly without duplicating final collection.

## Out of Scope

- Final Metric Contract persistence, history, and chart APIs (Benchmark Metrics).
- Replacing Benchmark Runner scheduling, execution, or terminal status polling for non-progress use cases.
- Live progress for non-benchmark workers (SQL queue, dataset reset, etc.).
- Lab learning Progress Tracking (quiz/lab completion progress in Platform DB) — different product concept.
- Frontend chart layout and Lab Shell chrome beyond consuming the progress contract.
- Cross-user spectator views or public live leaderboards.
- Hybrid or polling-based in-run progress (MVP is push-only live stream).
- Persisting in-run progress ticks or partial metrics as durable Platform DB history.
- Guaranteed delivery/replay of every interim tick across disconnects (latest-snapshot resume only).
