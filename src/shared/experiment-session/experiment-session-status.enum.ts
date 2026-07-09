export enum ExperimentSessionStatus {
  PROVISIONING = 'provisioning',
  READY = 'ready',
  FAILED = 'failed',
  TEARING_DOWN = 'tearing_down',
  EXPIRED = 'expired',
}

export const EXPERIMENT_SESSION_STATUSES = Object.values(
  ExperimentSessionStatus,
);
