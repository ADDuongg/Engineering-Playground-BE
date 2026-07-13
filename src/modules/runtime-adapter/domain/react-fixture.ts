import type { ReactElement } from 'react';

export type ReactFixtureOptions = {
  memo?: boolean;
  keyStrategy?: 'index' | 'stable';
  [key: string]: unknown;
};

export interface ReactFixtureContext {
  props: Record<string, unknown>;
  options: ReactFixtureOptions;
  action: string;
}

export interface ReactFixture {
  id: string;
  supportedActions: string[];
  defaultProps: Record<string, unknown>;
  /** Catalog keys typically emitted for this fixture. */
  measurementSet: string[];
  createRoot: (ctx: ReactFixtureContext) => ReactElement;
  /**
   * Apply one interaction against the live renderer API (update props/state).
   * Return true when handled.
   */
  applyInteraction?: (
    interaction: unknown,
    api: ReactFixtureRuntimeApi,
  ) => boolean;
}

export interface ReactFixtureRuntimeApi {
  update: (next: ReactElement) => void;
  getProps: () => Record<string, unknown>;
  setProps: (props: Record<string, unknown>) => void;
  remount: () => void;
}
