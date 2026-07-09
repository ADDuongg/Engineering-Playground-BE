import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ExplainRunResultDto } from '../metrics-pipeline/dto/metric-response.dto';
import { RunExplainUseCase } from './application/run-explain.usecase';
import { RunExplainDto } from './dto/run-explain.dto';

type AuthenticatedRequest = Request & { user?: JwtPayload };

@ApiTags('experiments')
@ApiBearerAuth()
@Controller('experiments')
export class ExplainRunnerController {
  constructor(private readonly runExplain: RunExplainUseCase) {}

  @Public()
  @Post('sql/explain')
  @ApiOperation({
    summary: 'Run EXPLAIN or EXPLAIN ANALYZE after dataset readiness check',
    description:
      'Success responses include plan-derived metrics[] and runId for Lab Shell visualization.',
  })
  @ApiOkResponse({ type: ExplainRunResultDto })
  async explainSql(
    @Body() dto: RunExplainDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.runExplain.execute({
      sql: dto.sql,
      parameters: dto.parameters,
      explainMode: dto.explainMode,
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
