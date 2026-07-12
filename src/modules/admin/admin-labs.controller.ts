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
import { AdminTrackSlugForLabsParamDto } from './dto/admin-track-slug-for-labs.param.dto';
import { AdminLabSlugParamDto } from './dto/admin-lab-slug.param.dto';
import { CreateLabDto } from './dto/create-lab.dto';
import { UpdateLabDto } from './dto/update-lab.dto';
import { CreateLabUseCase } from './application/create-lab.usecase';
import { UpdateLabUseCase } from './application/update-lab.usecase';
import { ListAdminLabsUseCase } from './application/list-admin-labs.usecase';
import { GetAdminLabUseCase } from './application/get-admin-lab.usecase';

@ApiTags('admin-labs')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminLabsController {
  constructor(
    private readonly createLabUseCase: CreateLabUseCase,
    private readonly updateLabUseCase: UpdateLabUseCase,
    private readonly listAdminLabsUseCase: ListAdminLabsUseCase,
    private readonly getAdminLabUseCase: GetAdminLabUseCase,
  ) {}

  @Get('tracks/:trackSlug/labs')
  @ApiOperation({ summary: 'List labs for a track (admin catalog)' })
  async list(@Param() params: AdminTrackSlugForLabsParamDto) {
    return this.listAdminLabsUseCase.execute(params.trackSlug);
  }

  @Post('tracks/:trackSlug/labs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create lab under track (omit status → coming-soon)',
  })
  async create(
    @Param() params: AdminTrackSlugForLabsParamDto,
    @Body() body: CreateLabDto,
  ) {
    return this.createLabUseCase.execute(params.trackSlug, body);
  }

  @Get('labs/:labSlug')
  @ApiOperation({ summary: 'Get lab by slug (admin catalog)' })
  async get(@Param() params: AdminLabSlugParamDto) {
    return this.getAdminLabUseCase.execute(params.labSlug);
  }

  @Patch('labs/:labSlug')
  @ApiOperation({
    summary:
      'Update lab metadata/status (soft-hide via status=coming-soon; no DELETE; slug/track immutable)',
  })
  async update(
    @Param() params: AdminLabSlugParamDto,
    @Body() body: UpdateLabDto,
  ) {
    return this.updateLabUseCase.execute(params.labSlug, body);
  }
}
