import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Observable, map } from 'rxjs';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GetBenchmarkMetricHistoryUseCase } from '../metrics-pipeline/application/get-benchmark-metric-history.usecase';
import { GetBenchmarkMetricsUseCase } from '../metrics-pipeline/application/get-benchmark-metrics.usecase';
import { EnqueueBenchmarkUseCase } from './application/enqueue-benchmark.usecase';
import { GetBenchmarkStatusUseCase } from './application/get-benchmark-status.usecase';
import { ObserveBenchmarkProgressUseCase } from './application/observe-benchmark-progress.usecase';
import { EnqueueBenchmarkDto } from './dto/enqueue-benchmark.dto';
import { GetBenchmarkStatusQueryDto } from './dto/get-benchmark-status.dto';
import { ObserveBenchmarkProgressQueryDto } from './dto/observe-benchmark-progress.dto';
import { GetBenchmarkMetricHistoryQueryDto } from '../metrics-pipeline/dto/get-benchmark-metric-history.dto';
import { GetBenchmarkMetricsQueryDto } from '../metrics-pipeline/dto/get-benchmark-metrics.dto';

type AuthenticatedRequest = Request & { user?: JwtPayload };

@ApiTags('benchmarks')
@ApiBearerAuth()
@Controller('benchmarks')
export class BenchmarkRunnerController {
  constructor(
    private readonly enqueueBenchmark: EnqueueBenchmarkUseCase,
    private readonly getBenchmarkStatus: GetBenchmarkStatusUseCase,
    private readonly getBenchmarkMetrics: GetBenchmarkMetricsUseCase,
    private readonly getBenchmarkMetricHistory: GetBenchmarkMetricHistoryUseCase,
    private readonly observeBenchmarkProgress: ObserveBenchmarkProgressUseCase,
  ) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Enqueue a load benchmark for an experiment session' })
  async enqueue(
    @Body() dto: EnqueueBenchmarkDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.enqueueBenchmark.execute({
      sessionId: dto.sessionId,
      profile: dto.profile,
      target: {
        sql: dto.target.sql,
        parameters: dto.target.parameters ?? [],
        dataset: dto.target.dataset,
      },
      context: {
        trackSlug: dto.context?.trackSlug,
        labSlug: dto.context?.labSlug,
        requestId: req.headers['x-request-id'] as string | undefined,
        userId: req.user?.sub,
      },
    });

    res.status(202);
    return result;
  }

  @Public()
  @Get('metrics/history')
  @ApiOperation({ summary: 'Retrieve benchmark metric history for a lab session' })
  history(
    @Query() query: GetBenchmarkMetricHistoryQueryDto,
  ) {
    return this.getBenchmarkMetricHistory.execute({
      sessionId: query.sessionId,
      labSlug: query.labSlug,
      limit: query.limit,
    });
  }

  @Public()
  @Sse(':jobId/progress')
  @ApiOperation({
    summary: 'Push-only live progress stream for an in-flight benchmark job',
  })
  progress(
    @Param('jobId') jobId: string,
    @Query() query: ObserveBenchmarkProgressQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Observable<MessageEvent> {
    return this.observeBenchmarkProgress
      .execute({
        jobId,
        userId: req.user?.sub,
        sessionId: query.sessionId,
      })
      .pipe(
        map((event) => ({
          type: event.type,
          data: event.data,
        })),
      );
  }

  @Public()
  @Get(':jobId/metrics')
  @ApiOperation({ summary: 'Get metrics for a completed benchmark job' })
  metrics(
    @Param('jobId') jobId: string,
    @Query() query: GetBenchmarkMetricsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getBenchmarkMetrics.execute({
      jobId,
      userId: req.user?.sub,
      sessionId: query.sessionId,
    });
  }

  @Public()
  @Get(':jobId')
  @ApiOperation({ summary: 'Get benchmark job lifecycle status' })
  async status(
    @Param('jobId') jobId: string,
    @Query() query: GetBenchmarkStatusQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getBenchmarkStatus.execute({
      jobId,
      userId: req.user?.sub,
      sessionId: query.sessionId,
    });
  }
}
