export interface SandboxResultField {
  name: string;
  dataTypeId: number;
}

export interface SandboxExecuteResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  fields?: SandboxResultField[];
}

export interface SqlValidationResult {
  valid: true;
  normalizedSql: string;
  statementKind: import('./sql-statement-kind.enum').SqlStatementKind;
}

export interface SandboxErrorDetails {
  violationCode: import('./sandbox-violation-code.enum').SandboxViolationCode;
  hint?: string;
  policyVersion: string;
}
