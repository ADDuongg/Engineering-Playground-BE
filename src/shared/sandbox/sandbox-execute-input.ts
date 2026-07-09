export interface SandboxExecutionContext {
  requestId?: string;
  trackSlug?: string;
  labSlug?: string;
  userId?: string;
}

export interface SandboxExecuteInput {
  sql: string;
  parameters: unknown[];
  sessionId?: string;
  schemaName?: string;
  context?: SandboxExecutionContext;
}
