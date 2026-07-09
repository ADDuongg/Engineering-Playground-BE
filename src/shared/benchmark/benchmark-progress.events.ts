/** Redis key/channel helpers and observability event names for benchmark progress. */

export const BENCHMARK_PROGRESS_KEY_PREFIX = 'benchmark:progress:';
export const BENCHMARK_PROGRESS_CHANNEL_PREFIX = 'benchmark:progress:channel:';

export function benchmarkProgressKey(jobId: string): string {
  return `${BENCHMARK_PROGRESS_KEY_PREFIX}${jobId}`;
}

export function benchmarkProgressChannel(jobId: string): string {
  return `${BENCHMARK_PROGRESS_CHANNEL_PREFIX}${jobId}`;
}

/** Structured log / observability event names (contract). */
export const BENCHMARK_PROGRESS_LOG_EVENTS = {
  PUBLISHED: 'benchmark_progress_published',
  OBSERVE_START: 'benchmark_progress_observe_start',
  OBSERVE_END: 'benchmark_progress_observe_end',
} as const;
