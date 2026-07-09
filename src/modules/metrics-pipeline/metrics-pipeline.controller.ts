import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { GetMetricHistoryUseCase } from './application/get-metric-history.usecase';
import { GetMetricHistoryQueryDto } from './dto/get-metric-history.dto';

@ApiTags('experiments')
@Controller('experiments/metrics')
export class MetricsPipelineController {
  constructor(
    private readonly getMetricHistory: GetMetricHistoryUseCase,
  ) {}

  @Public()
  @Get('history')
  @ApiOperation({ summary: 'Retrieve metric snapshots for before/after comparison' })
  getHistory(@Query() query: GetMetricHistoryQueryDto) {
    return this.getMetricHistory.execute({
      sessionId: query.sessionId,
      labSlug: query.labSlug,
      limit: query.limit,
    });
  }
}
