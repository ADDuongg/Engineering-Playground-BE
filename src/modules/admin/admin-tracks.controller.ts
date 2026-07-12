import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@db-play/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminTrackSlugParamDto } from './dto/admin-track-slug.param.dto';
import { CreateTrackDto } from './dto/create-track.dto';
import { UpdateTrackDto } from './dto/update-track.dto';
import { CreateTrackUseCase } from './application/create-track.usecase';
import { UpdateTrackUseCase } from './application/update-track.usecase';
import { ListAdminTracksUseCase } from './application/list-admin-tracks.usecase';
import { GetAdminTrackUseCase } from './application/get-admin-track.usecase';

@ApiTags('admin-tracks')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/tracks')
export class AdminTracksController {
  constructor(
    private readonly createTrackUseCase: CreateTrackUseCase,
    private readonly updateTrackUseCase: UpdateTrackUseCase,
    private readonly listAdminTracksUseCase: ListAdminTracksUseCase,
    private readonly getAdminTrackUseCase: GetAdminTrackUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all tracks (admin catalog)' })
  async list() {
    return this.listAdminTracksUseCase.execute();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get track by slug (admin catalog)' })
  async get(@Param() params: AdminTrackSlugParamDto) {
    return this.getAdminTrackUseCase.execute(params.slug);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create track (omit status → coming-soon; no hard delete)',
  })
  async create(@Body() body: CreateTrackDto) {
    return this.createTrackUseCase.execute(body);
  }

  @Patch(':slug')
  @ApiOperation({
    summary:
      'Update track metadata/status (soft-hide via status=coming-soon; slug immutable)',
  })
  async update(
    @Param() params: AdminTrackSlugParamDto,
    @Body() body: UpdateTrackDto,
  ) {
    return this.updateTrackUseCase.execute(params.slug, body);
  }
}
