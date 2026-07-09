import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetLabSummaryUseCase } from './application/get-lab-summary.usecase';
import { LabSlugParamDto } from './dto/lab-slug.param.dto';

@ApiTags('labs')
@ApiBearerAuth()
@Controller('labs')
export class LabsController {
  constructor(private readonly getLabSummaryUseCase: GetLabSummaryUseCase) {}

  @Get(':labSlug/summary')
  @ApiOperation({
    summary: 'Get lab summary (curriculum, guided SQL/DDL, quiz gate)',
  })
  async getSummary(@Param() params: LabSlugParamDto) {
    return this.getLabSummaryUseCase.execute(params.labSlug);
  }
}
