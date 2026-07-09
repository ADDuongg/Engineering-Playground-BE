import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GetJobStatusUseCase } from './application/get-job-status.usecase';
import { GetJobStatusQueryDto } from './dto/get-job-status.dto';

type AuthenticatedRequest = Request & { user?: JwtPayload };

@ApiTags('jobs')
@ApiBearerAuth()
@Controller('jobs')
export class WorkerQueueController {
  constructor(private readonly getJobStatus: GetJobStatusUseCase) {}

  @Public()
  @Get(':jobId')
  @ApiOperation({ summary: 'Get foundation-managed job lifecycle status' })
  async status(
    @Param('jobId') jobId: string,
    @Query() query: GetJobStatusQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.getJobStatus.execute({
      jobId,
      userId: req.user?.sub,
      sessionId: query.sessionId,
    });
  }
}
