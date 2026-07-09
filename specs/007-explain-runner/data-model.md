# Data Model: Explain Runner

## ExplainRunInput

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| sql | string | yes | Inner query (no EXPLAIN prefix) |
| parameters | unknown[] | yes | Bound parameters |
| explainMode | `explain` \| `explain_analyze` | yes | Wrap mode |
| dataset | family, tier, version? | yes | Readiness identity |
| sessionId | string | no | Session schema scope |
| context | trackSlug, labSlug, requestId, userId | no | Attribution |

## ExplainPlanNode

| Field | Type | Notes |
| ----- | ---- | ----- |
| nodeType | string | e.g. Seq Scan, Hash Join |
| relationName | string? | Table when applicable |
| indexName | string? | Index when applicable |
| filter | string? | Filter condition |
| sortKey | string? | Sort columns |
| sortMethod | string? | Sort algorithm |
| startupCost | number | Planner startup cost |
| totalCost | number | Planner total cost |
| planRows | number? | Estimated rows |
| planWidth | number? | Estimated width |
| actualRows | number? | EXPLAIN ANALYZE actual rows |
| actualLoops | number? | EXPLAIN ANALYZE loops |
| children | ExplainPlanNode[] | Nested plan nodes |

## ExplainRunResult

| Field | Type | Notes |
| ----- | ---- | ----- |
| plan | ExplainPlanNode | Root plan tree |
| planningTimeMs | number? | From EXPLAIN ANALYZE |
| executionTimeMs | number? | Sandbox timing + plan execution time |
| explainMode | enum | Request mode |
| statementKind | SqlStatementKind | EXPLAIN or EXPLAIN_ANALYZE |
| dataset | family, tier, version | Resolved metadata |
| truncated | boolean? | Plan node cap exceeded |
| rawPlanText | string? | Supplementary diagnostic only |
