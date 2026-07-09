export interface ExplainPlanNode {
  nodeType: string;
  relationName?: string;
  indexName?: string;
  filter?: string;
  sortKey?: string;
  sortMethod?: string;
  startupCost: number;
  totalCost: number;
  planRows?: number;
  planWidth?: number;
  actualRows?: number;
  actualLoops?: number;
  children: ExplainPlanNode[];
}
