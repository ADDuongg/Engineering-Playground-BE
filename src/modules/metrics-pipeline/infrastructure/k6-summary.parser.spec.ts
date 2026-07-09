import { K6SummaryParser } from './k6-summary.parser';

describe('K6SummaryParser', () => {
  const parser = new K6SummaryParser();

  const validSummary = {
    metrics: {
      http_req_duration: {
        values: {
          avg: 12.5,
          'p(95)': 40,
          'p(99)': 80,
        },
      },
      http_reqs: {
        values: {
          rate: 100,
        },
      },
      http_req_failed: {
        values: {
          rate: 0.05,
        },
      },
    },
  };

  /** Shape produced by k6 --summary-export with default trend stats (no nested values, no p(99)). */
  const realK6ExportSummary = {
    metrics: {
      http_req_duration: {
        avg: 0.969,
        min: 0.321,
        med: 0.798,
        max: 20.897,
        'p(90)': 1.304,
        'p(95)': 1.63,
      },
      http_reqs: {
        count: 1000,
        rate: 99.98,
      },
      http_req_failed: {
        passes: 1000,
        fails: 0,
        value: 1,
      },
    },
  };

  it('maps k6 summary to six catalog metrics', () => {
    const { metrics } = parser.parse(validSummary);

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'latency_avg_ms', value: 12.5, unit: 'ms' }),
        expect.objectContaining({ key: 'latency_p95_ms', value: 40 }),
        expect.objectContaining({ key: 'latency_p99_ms', value: 80 }),
        expect.objectContaining({ key: 'achieved_rps', value: 100, unit: 'rps' }),
        expect.objectContaining({ key: 'throughput_rps', value: 95 }),
        expect.objectContaining({ key: 'error_rate_pct', value: 5, unit: '%' }),
      ]),
    );
    expect(metrics).toHaveLength(6);
  });

  it('parses real k6 --summary-export shape (value rate + missing p99)', () => {
    const { metrics } = parser.parse(realK6ExportSummary);

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'latency_avg_ms', value: 0.969 }),
        expect.objectContaining({ key: 'latency_p95_ms', value: 1.63 }),
        // Falls back to p(95) when p(99) is absent from default export
        expect.objectContaining({ key: 'latency_p99_ms', value: 1.63 }),
        expect.objectContaining({ key: 'achieved_rps', value: 99.98 }),
        expect.objectContaining({ key: 'throughput_rps', value: 0 }),
        expect.objectContaining({ key: 'error_rate_pct', value: 100 }),
      ]),
    );
    expect(metrics).toHaveLength(6);
  });

  it('throws when required fields are missing', () => {
    expect(() => parser.parse({ metrics: {} })).toThrow(/Incomplete k6 summary/);
  });
});
