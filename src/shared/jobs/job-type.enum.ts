export enum JobType {
  BENCHMARK = 'benchmark',
  DATASET_RESET = 'dataset-reset',
  SQL_EXECUTION = 'sql-execution',
}

export const JOB_TYPES = Object.values(JobType);
