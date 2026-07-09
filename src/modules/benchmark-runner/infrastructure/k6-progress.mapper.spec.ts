import { K6ProgressMapper } from './k6-progress.mapper';

describe('K6ProgressMapper', () => {
  const mapper = new K6ProgressMapper();

  it('maps achieved RPS, latency, and error rate as provisional metrics', () => {
    const result = mapper.map({
      metrics: {
        http_req_duration: { values: { avg: 12.5 } },
        http_reqs: { values: { rate: 97.2 } },
        http_req_failed: { values: { rate: 0.05 } },
      },
    });

    expect(result.currentRps).toBe(97.2);
    expect(result.partialMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'achieved_rps',
          value: 97.2,
          provisional: true,
        }),
        expect.objectContaining({
          key: 'latency_avg_ms',
          value: 12.5,
          provisional: true,
        }),
        expect.objectContaining({
          key: 'error_rate_pct',
          value: 5,
          provisional: true,
        }),
      ]),
    );
    expect(result.partialMetrics.every((m) => m.provisional === true)).toBe(
      true,
    );
    expect(result.partialMetrics.map((m) => m.key)).not.toContain(
      'latency_p95_ms',
    );
  });

  it('omits unmeasured fields instead of inventing zeros', () => {
    const result = mapper.map({ metrics: {} });
    expect(result.currentRps).toBeNull();
    expect(result.partialMetrics).toEqual([]);
  });

  it('derives RPS from count and elapsed when rate missing', () => {
    const result = mapper.map({
      elapsedMs: 2000,
      metrics: {
        http_reqs: { values: { count: 200 } },
      },
    });
    expect(result.currentRps).toBe(100);
  });
});
