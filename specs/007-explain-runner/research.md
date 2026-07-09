# Research: Explain Runner

## Decision: Use PostgreSQL `EXPLAIN (FORMAT JSON)` internally

**Rationale**: Native JSON plan output avoids fragile text parsing and maps cleanly to hierarchical `ExplainPlanNode` trees for frontend visualization.

**Alternatives considered**: Raw text plan passthrough (rejected — spec FR-004 forbids raw-only); third-party plan parser libraries (rejected — unnecessary dependency for stable PG JSON format).

## Decision: Inner SQL + `explainMode` in API contract

**Rationale**: Lab shell submits learner query separately from mode; runner wraps with `EXPLAIN (FORMAT JSON)` or `EXPLAIN (ANALYZE, FORMAT JSON)` before sandbox validation.

**Alternatives considered**: Accept full `EXPLAIN ...` prefix in `sql` field (rejected — duplicates mode, harder for labs to toggle analyze without rewriting SQL).

## Decision: Reuse Experiment Runner orchestration patterns

**Rationale**: Dataset readiness gate, session schema resolution, sandbox delegation, and audit logging are proven in `RunExperimentSqlUseCase`.

**Alternatives considered**: Extend experiment-runner module (rejected — violates single responsibility and spec scope boundaries).
