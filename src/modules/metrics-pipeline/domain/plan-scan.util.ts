import { ExplainPlanNode } from '@db-play/types';

export interface PlanScanSummary {
  rowsScanned: number;
  seqScanUsed: boolean;
  indexScanUsed: boolean;
}

export function summarizePlanScans(plan: ExplainPlanNode): PlanScanSummary {
  let rowsScanned = 0;
  let seqScanUsed = false;
  let indexScanUsed = false;

  const walk = (node: ExplainPlanNode): void => {
    const nodeType = node.nodeType.toLowerCase();

    if (nodeType.includes('scan')) {
      const rowEstimate =
        node.actualRows !== undefined
          ? node.actualRows * (node.actualLoops ?? 1)
          : (node.planRows ?? 0) * (node.actualLoops ?? 1);
      rowsScanned += rowEstimate;
    }

    if (nodeType.includes('seq scan')) {
      seqScanUsed = true;
    }

    if (node.indexName || nodeType.includes('index scan')) {
      indexScanUsed = true;
    }

    for (const child of node.children) {
      walk(child);
    }
  };

  walk(plan);

  return { rowsScanned, seqScanUsed, indexScanUsed };
}
