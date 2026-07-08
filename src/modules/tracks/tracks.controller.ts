import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ListTracksUseCase } from './application/list-tracks.usecase';
import { GetTrackBySlugUseCase } from './application/get-track-by-slug.usecase';
import { TrackSlugParamDto } from './dto/track-slug.param.dto';

@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(
    private readonly listTracksUseCase: ListTracksUseCase,
    private readonly getTrackBySlugUseCase: GetTrackBySlugUseCase,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all learning tracks' })
  async listTracks() {
    return this.listTracksUseCase.execute();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get track configuration by slug' })
  async getTrackBySlug(@Param() params: TrackSlugParamDto) {
    return this.getTrackBySlugUseCase.execute(params.slug);
  }
}
