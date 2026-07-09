import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ExperimentRunResultDto } from '../metrics-pipeline/dto/metric-response.dto';
import { RunExperimentSqlUseCase } from './application/run-experiment-sql.usecase';
import { EnqueueSqlRunUseCase } from './application/enqueue-sql-run.usecase';
import { RunExperimentSqlDto } from './dto/run-experiment-sql.dto';
import { EnqueueSqlRunDto } from './dto/enqueue-sql-run.dto';

type AuthenticatedRequest = Request & { user?: JwtPayload };

@ApiTags('experiments')
@ApiBearerAuth()
@Controller('experiments')
export class ExperimentRunnerController {
  constructor(
    private readonly runExperimentSql: RunExperimentSqlUseCase,
    private readonly enqueueSqlRun: EnqueueSqlRunUseCase,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('sql/run')
  @ApiOperation({
    summary: 'Execute lab SQL after dataset readiness check',
    description:
      'Success responses include backend-normalized metrics[] and runId for Lab Shell metrics panel consumption.',
  })
  @ApiOkResponse({ type: ExperimentRunResultDto })
  async runSql(
    @Body() dto: RunExperimentSqlDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const internalToken = req.headers['x-benchmark-internal-token'];
    const expectedToken = this.configService.get<string>(
      'benchmark.internalSecret',
      'benchmark-internal-dev',
    );
    const benchmarkInternal =
      typeof internalToken === 'string' &&
      internalToken.length > 0 &&
      internalToken === expectedToken;

    return this.runExperimentSql.execute({
      sql: dto.sql,
      parameters: dto.parameters,
      sessionId: dto.sessionId,
      dataset: {
        family: dto.dataset.family,
        tier: dto.dataset.tier,
        version: dto.dataset.version,
      },
      context: {
        requestId: req.headers['x-request-id'] as string | undefined,
        trackSlug: dto.context?.trackSlug,
        labSlug: dto.context?.labSlug,
        userId: req.user?.sub,
        benchmarkInternal,
      },
    });
  }

  @Public()
  @Post('sql/runs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Enqueue an interactive SQL run for asynchronous execution',
    description:
      'Returns immediately with a job reference. Poll GET /jobs/:jobId for lifecycle status; the completed result (rows + metrics) is embedded in the job status payloadSummary.executionResult.',
  })
  @ApiAcceptedResponse({
    description: 'SQL run accepted and queued for execution.',
  })
  async enqueueSql(
    @Body() dto: EnqueueSqlRunDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.enqueueSqlRun.execute({
      sql: dto.sql,
      parameters: dto.parameters,
      sessionId: dto.sessionId,
      dataset: {
        family: dto.dataset.family,
        tier: dto.dataset.tier,
        version: dto.dataset.version,
      },
      context: {
        requestId: req.headers['x-request-id'] as string | undefined,
        trackSlug: dto.context?.trackSlug,
        labSlug: dto.context?.labSlug,
        userId: req.user?.sub,
      },
    });
  }
}
