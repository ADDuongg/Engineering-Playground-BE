import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { CompleteLabUseCase } from './application/complete-lab.usecase';
import { GetLearningPathUseCase } from './application/get-learning-path.usecase';
import { GetTrackProgressUseCase } from './application/get-track-progress.usecase';
import { LabSlugParamDto } from './dto/lab-slug.param.dto';
import { ProgressTrackSlugParamDto } from './dto/progress-track-slug.param.dto';
import { TrackSlugParamDto } from '../tracks/dto/track-slug.param.dto';

@ApiTags('progress')
@Controller()
export class ProgressController {
  constructor(
    private readonly completeLabUseCase: CompleteLabUseCase,
    private readonly getTrackProgressUseCase: GetTrackProgressUseCase,
    private readonly getLearningPathUseCase: GetLearningPathUseCase,
  ) {}

  @Public()
  @Get('tracks/:slug/learning-path')
  @ApiOperation({
    summary: 'Get public ordered learning path for a track (no completion flags)',
  })
  async getLearningPath(@Param() params: TrackSlugParamDto) {
    return this.getLearningPathUseCase.execute(params.slug);
  }

  @Get('progress/tracks/:trackSlug')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get authenticated progress summary for a track',
  })
  async getTrackProgress(
    @CurrentUser() user: JwtPayload,
    @Param() params: ProgressTrackSlugParamDto,
  ) {
    return this.getTrackProgressUseCase.execute(user.sub, params.trackSlug);
  }

  @Post('progress/labs/:labSlug/complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark a catalog lab as completed for the current user (idempotent)',
  })
  async completeLab(
    @CurrentUser() user: JwtPayload,
    @Param() params: LabSlugParamDto,
  ) {
    return this.completeLabUseCase.execute(user.sub, params.labSlug);
  }
}
