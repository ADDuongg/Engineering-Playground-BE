import { SqlStatementKind } from '@db-play/types';

export interface SandboxConfig {
  queryTimeoutMs: number;
  policyVersion: string;
  maxRows: number;
  allowedStatementKinds: SqlStatementKind[];
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  queryTimeoutMs: 30_000,
  policyVersion: '1',
  maxRows: 1000,
  allowedStatementKinds: [
    SqlStatementKind.SELECT,
    SqlStatementKind.EXPLAIN,
    SqlStatementKind.EXPLAIN_ANALYZE,
    SqlStatementKind.CREATE_INDEX,
    SqlStatementKind.DROP_INDEX,
  ],
};

export const SANDBOX_CONFIG = 'SANDBOX_CONFIG';
