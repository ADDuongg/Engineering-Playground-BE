import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { DatasetReadinessStatus } from '@db-play/types';
import { Public } from '../../common/decorators/public.decorator';
import { PrepareDatasetUseCase } from './application/prepare-dataset.usecase';
import { GetDatasetMetadataUseCase } from './application/get-dataset-metadata.usecase';
import { ResetDatasetUseCase } from './application/reset-dataset.usecase';
import { PrepareDatasetDto } from './dto/prepare-dataset.dto';
import { ResetDatasetDto } from './dto/reset-dataset.dto';
import { DatasetQueryDto } from './dto/dataset-query.dto';

type AuthenticatedRequest = Request & { user?: JwtPayload };

@ApiTags('datasets')
@Controller('datasets')
export class DatasetLoaderController {
  constructor(
    private readonly prepareDataset: PrepareDatasetUseCase,
    private readonly getDatasetMetadata: GetDatasetMetadataUseCase,
    private readonly resetDataset: ResetDatasetUseCase,
  ) {}

  @Public()
  @Post('prepare')
  @ApiOperation({ summary: 'Load platform dataset into playground' })
  async prepare(
    @Body() dto: PrepareDatasetDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.prepareDataset.execute({
      family: dto.family,
      tier: dto.tier,
      version: dto.version,
      sessionId: dto.sessionId,
      context: {
        requestId: req.headers['x-request-id'] as string | undefined,
        labSlug: dto.context?.labSlug,
        trackSlug: dto.context?.trackSlug,
      },
    });

    if (result.status === DatasetReadinessStatus.PREPARING) {
      res.status(202);
    }

    return result;
  }

  @Public()
  @Get('prepare/status')
  @ApiOperation({ summary: 'Poll dataset preparation status' })
  async preparationStatus(@Query() query: DatasetQueryDto) {
    return this.prepareDataset.getStatus(
      query.family,
      query.tier,
      query.version,
      query.sessionId,
    );
  }

  @Public()
  @Get('metadata')
  @ApiOperation({ summary: 'Get dataset metadata catalog for lab shells' })
  async metadata(@Query() query: DatasetQueryDto) {
    return this.getDatasetMetadata.execute(
      query.family,
      query.tier,
      query.version,
      query.sessionId,
    );
  }

  @Public()
  @Post('reset')
  @ApiOperation({
    summary: 'Enqueue playground dataset reset (always async)',
  })
  async reset(
    @Body() dto: ResetDatasetDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.resetDataset.execute({
      family: dto.family,
      tier: dto.tier,
      version: dto.version,
      sessionId: dto.sessionId,
      context: {
        requestId: req.headers['x-request-id'] as string | undefined,
        labSlug: dto.context?.labSlug,
        userId: req.user?.sub,
      },
    });

    res.status(202);
    return result;
  }

  /**
   * @deprecated Prefer GET /jobs/:jobId for foundation-managed reset jobs.
   */
  @Public()
  @Get('reset/status')
  @ApiOperation({
    summary: 'Poll dataset reset readiness (deprecated — prefer GET /jobs/:jobId)',
    deprecated: true,
  })
  async resetStatus(@Query() query: DatasetQueryDto) {
    return this.resetDataset.getStatus(
      query.family,
      query.tier,
      query.version,
      query.sessionId,
    );
  }
}
