export interface ReactSandboxPolicy {
  timeoutMs: number;
  maxInteractions: number;
  maxItems: number;
  policyVersion: string;
}

export const DEFAULT_REACT_SANDBOX_POLICY: ReactSandboxPolicy = {
  timeoutMs: 5000,
  maxInteractions: 50,
  maxItems: 500,
  policyVersion: 'react-sandbox-v1',
};
