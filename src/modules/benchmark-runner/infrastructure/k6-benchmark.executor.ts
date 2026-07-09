import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { createReadStream } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import { BenchmarkTarget } from '@db-play/types';

export interface K6ExecutionInput {
  rps: number;
  durationSeconds: number;
  sessionId: string;
  target: BenchmarkTarget;
  context?: {
    trackSlug?: string;
    labSlug?: string;
  };
  /** Throttled interim progress callback (~1 Hz upstream). */
  onProgress?: (sample: Record<string, unknown>) => void | Promise<void>;
}

export interface K6ExecutionResult {
  success: boolean;
  summary?: Record<string, unknown>;
  exitCode?: number;
  stderr?: string;
}

@Injectable()
export class K6BenchmarkExecutor {
  private readonly logger = new Logger(K6BenchmarkExecutor.name);

  constructor(private readonly configService: ConfigService) {}

  async execute(input: K6ExecutionInput): Promise<K6ExecutionResult> {
    const baseUrl = this.configService.get<string>(
      'benchmark.internalBaseUrl',
      'http://localhost:3000',
    );
    const targetUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/experiments/sql/run`;
    const k6Binary = this.configService.get<string>('benchmark.k6Binary', 'k6');
    const internalToken = this.configService.get<string>(
      'benchmark.internalSecret',
      'benchmark-internal-dev',
    );
    const progressIntervalMs = this.configService.get<number>(
      'benchmark.progressIntervalMs',
      1000,
    );

    // Only whitelist fields accepted by RunExperimentSqlDto (forbidNonWhitelisted).
    // Job context may include userId/requestId — those must not be forwarded in the body.
    const requestBody = {
      sql: input.target.sql,
      parameters: input.target.parameters ?? [],
      sessionId: input.sessionId,
      dataset: {
        family: input.target.dataset.family,
        tier: input.target.dataset.tier,
        version: input.target.dataset.version ?? 'v1',
      },
      context: {
        trackSlug: input.context?.trackSlug,
        labSlug: input.context?.labSlug,
      },
    };

    this.logger.log({
      event: 'k6_benchmark_starting',
      sessionId: input.sessionId,
      targetUrl,
      sqlLength: input.target.sql?.length ?? 0,
      sqlPreview: (input.target.sql ?? '').slice(0, 80),
      rps: input.rps,
      durationSeconds: input.durationSeconds,
    });

    const preflight = await this.preflight(targetUrl, requestBody, internalToken);
    if (!preflight.ok) {
      this.logger.warn({
        event: 'k6_preflight_failed',
        sessionId: input.sessionId,
        targetUrl,
        status: preflight.status,
        bodyPreview: preflight.bodyPreview,
      });
      return {
        success: false,
        exitCode: preflight.status,
        stderr: `Benchmark preflight failed against ${targetUrl}: HTTP ${preflight.status}. ${preflight.bodyPreview}`,
      };
    }

    const workDir = await mkdtemp(join(tmpdir(), 'benchmark-k6-'));
    const scriptPath = join(workDir, 'benchmark.js');
    const summaryPath = join(workDir, 'summary.json');
    const metricsPath = join(workDir, 'metrics.ndjson');

    try {
      await writeFile(
        scriptPath,
        this.buildScript(input, targetUrl, requestBody, internalToken),
      );
      await writeFile(metricsPath, '');

      const timeoutMs =
        (this.configService.get<number>('benchmark.jobTimeoutSeconds', 120) +
          input.durationSeconds) *
        1000;

      const aggregates = {
        http_req_duration_sum: 0,
        http_req_duration_count: 0,
        http_reqs: 0,
        http_req_failed: 0,
        startedAt: Date.now(),
      };

      let lastProgressAt = 0;
      const emitProgress = async () => {
        if (!input.onProgress) {
          return;
        }
        const now = Date.now();
        if (now - lastProgressAt < progressIntervalMs) {
          return;
        }
        lastProgressAt = now;
        const elapsedMs = Math.max(now - aggregates.startedAt, 1);
        const sample = this.buildInterimSample(aggregates, elapsedMs);
        await input.onProgress(sample);
      };

      const exitCode = await this.runK6Process({
        k6Binary,
        scriptPath,
        summaryPath,
        metricsPath,
        timeoutMs,
        onMetricLine: async (line) => {
          this.accumulateMetricLine(line, aggregates);
          await emitProgress();
        },
      });

      if (input.onProgress) {
        const elapsedMs = Math.max(Date.now() - aggregates.startedAt, 1);
        await input.onProgress(this.buildInterimSample(aggregates, elapsedMs));
      }

      if (exitCode !== 0) {
        return {
          success: false,
          exitCode,
          stderr: `k6 exited with code ${exitCode}`,
        };
      }

      const summaryRaw = await readFile(summaryPath, 'utf8');
      const summary = JSON.parse(summaryRaw) as Record<string, unknown>;

      return { success: true, summary };
    } catch (error) {
      const exitCode =
        error && typeof error === 'object' && 'code' in error
          ? Number((error as { code?: number | string }).code)
          : undefined;
      const stderr =
        error && typeof error === 'object' && 'stderr' in error
          ? String((error as { stderr?: string }).stderr ?? '')
          : error instanceof Error
            ? error.message
            : String(error);

      this.logger.warn({
        event: 'k6_execution_failed',
        sessionId: input.sessionId,
        exitCode,
        stderr: stderr.slice(0, 500),
      });

      return {
        success: false,
        exitCode: Number.isFinite(exitCode) ? exitCode : undefined,
        stderr,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private buildInterimSample(
    aggregates: {
      http_req_duration_sum: number;
      http_req_duration_count: number;
      http_reqs: number;
      http_req_failed: number;
      startedAt: number;
    },
    elapsedMs: number,
  ): Record<string, unknown> {
    const rate = (aggregates.http_reqs / elapsedMs) * 1000;
    const avg =
      aggregates.http_req_duration_count > 0
        ? aggregates.http_req_duration_sum / aggregates.http_req_duration_count
        : undefined;
    const failedRate =
      aggregates.http_reqs > 0
        ? aggregates.http_req_failed / aggregates.http_reqs
        : undefined;

    return {
      elapsedMs,
      metrics: {
        http_reqs: { values: { rate, count: aggregates.http_reqs } },
        http_req_duration:
          avg === undefined ? {} : { values: { avg } },
        http_req_failed:
          failedRate === undefined ? {} : { values: { rate: failedRate } },
      },
    };
  }

  private accumulateMetricLine(
    line: string,
    aggregates: {
      http_req_duration_sum: number;
      http_req_duration_count: number;
      http_reqs: number;
      http_req_failed: number;
    },
  ): void {
    try {
      const row = JSON.parse(line) as {
        type?: string;
        metric?: string;
        data?: { value?: number; tags?: { expected_response?: string } };
      };
      if (row.type !== 'Point' || !row.metric || !row.data) {
        return;
      }
      const value = row.data.value;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return;
      }
      if (row.metric === 'http_reqs') {
        aggregates.http_reqs += value;
      } else if (row.metric === 'http_req_duration') {
        aggregates.http_req_duration_sum += value;
        aggregates.http_req_duration_count += 1;
      } else if (row.metric === 'http_req_failed') {
        aggregates.http_req_failed += value;
      }
    } catch {
      // ignore malformed NDJSON lines
    }
  }

  private runK6Process(params: {
    k6Binary: string;
    scriptPath: string;
    summaryPath: string;
    metricsPath: string;
    timeoutMs: number;
    onMetricLine: (line: string) => Promise<void>;
  }): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        params.k6Binary,
        [
          'run',
          params.scriptPath,
          '--summary-export',
          params.summaryPath,
          '--out',
          `json=${params.metricsPath}`,
          '--quiet',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );

      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const rl = createInterface({
        input: createReadStream(params.metricsPath, {
          encoding: 'utf8',
          flags: 'r',
        }),
        crlfDelay: Infinity,
      });

      // Tail newly appended lines; createReadStream may need reopen — use polling fallback
      let position = 0;
      const poll = setInterval(() => {
        void (async () => {
          try {
            const content = await readFile(params.metricsPath, 'utf8');
            if (content.length <= position) {
              return;
            }
            const chunk = content.slice(position);
            position = content.length;
            const lines = chunk.split('\n').filter((l) => l.trim().length > 0);
            for (const line of lines) {
              await params.onMetricLine(line);
            }
          } catch {
            // file may not exist yet
          }
        })();
      }, 200);

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
      }, params.timeoutMs);

      child.on('error', (err) => {
        clearInterval(poll);
        clearTimeout(timer);
        rl.close();
        reject(err);
      });

      child.on('close', (code) => {
        clearInterval(poll);
        clearTimeout(timer);
        rl.close();
        if (stderr && code !== 0) {
          const error = new Error(stderr) as Error & {
            code?: number;
            stderr?: string;
          };
          error.code = code ?? undefined;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve(code ?? 1);
      });
    });
  }

  private async preflight(
    targetUrl: string,
    requestBody: Record<string, unknown>,
    internalToken: string,
  ): Promise<{ ok: boolean; status: number; bodyPreview: string }> {
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Benchmark-Internal-Token': internalToken,
        },
        body: JSON.stringify(requestBody),
      });
      const text = await response.text();
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        bodyPreview: text.slice(0, 300),
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        bodyPreview:
          error instanceof Error ? error.message : 'preflight request failed',
      };
    }
  }

  private buildScript(
    input: K6ExecutionInput,
    targetUrl: string,
    requestBody: Record<string, unknown>,
    internalToken: string,
  ): string {
    const bodyJson = JSON.stringify(requestBody);
    const maxVUs = Math.min(Math.max(input.rps * 10, 20), 1000);

    return `
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  // Include p(99) in --summary-export (defaults are avg/min/med/max/p(90)/p(95) only).
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    benchmark: {
      executor: 'constant-arrival-rate',
      rate: ${input.rps},
      timeUnit: '1s',
      duration: '${input.durationSeconds}s',
      preAllocatedVUs: ${Math.min(maxVUs, 100)},
      maxVUs: ${maxVUs},
    },
  },
};

export default function () {
  const res = http.post(
    ${JSON.stringify(targetUrl)},
    ${JSON.stringify(bodyJson)},
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Benchmark-Internal-Token': ${JSON.stringify(internalToken)},
      },
    },
  );
  check(res, { 'status is 2xx': (r) => r.status >= 200 && r.status < 300 });
}
`;
  }
}
