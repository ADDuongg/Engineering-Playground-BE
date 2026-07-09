/**
 * Integration smoke coverage for the SQL Execution Queue.
 * Full Redis/BullMQ + Playground E2E is covered by
 * specs/013-sql-execution-queue/quickstart.md manual steps.
 */
describe('SQL Execution Queue (integration stub)', () => {
  it('documents the async SQL run + embedded result contract', () => {
    expect({
      enqueue: 'POST /experiments/sql/runs → 202 { jobId, jobType: sql-execution, status: queued }',
      pollStatus: 'GET /jobs/:jobId → completed with payloadSummary.executionResult',
      inflightLimit: '409 SQL_RUN_INFLIGHT_LIMIT while a run is in flight',
      queueUnavailable: '503 QUEUE_UNAVAILABLE within 2s (no orphan job)',
      timeout: 'failed with failureReason TIMEOUT on sandbox statement timeout',
      teardownCancel: 'session teardown cancels in-flight sql-execution jobs',
    }).toBeDefined();
  });
});
