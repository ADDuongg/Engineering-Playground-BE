export enum RateLimitOperation {
  SQL_RUN = 'sql_run',
  EXPLAIN_RUN = 'explain_run',
  DATASET_RESET = 'dataset_reset',
  BENCHMARK_ENQUEUE = 'benchmark_enqueue',
}

export const RATE_LIMIT_OPERATION_LABELS: Record<RateLimitOperation, string> = {
  [RateLimitOperation.SQL_RUN]: 'SQL run',
  [RateLimitOperation.EXPLAIN_RUN]: 'EXPLAIN',
  [RateLimitOperation.DATASET_RESET]: 'dataset reset',
  [RateLimitOperation.BENCHMARK_ENQUEUE]: 'benchmark enqueue',
};
