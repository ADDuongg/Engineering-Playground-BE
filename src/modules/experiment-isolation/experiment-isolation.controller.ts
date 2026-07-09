import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ProvisionExperimentSessionUseCase } from './application/provision-experiment-session.usecase';
import { GetExperimentSessionUseCase } from './application/get-experiment-session.usecase';
import { TeardownExperimentSessionUseCase } from './application/teardown-experiment-session.usecase';
import {
  ExperimentSessionIdParamDto,
  ProvisionExperimentSessionDto,
} from './dto/provision-experiment-session.dto';
import { ExperimentSessionSummary } from '@db-play/types';

type AuthenticatedRequest = Request & { user?: JwtPayload };

@ApiTags('experiments')
@ApiBearerAuth()
@Controller('experiments/sessions')
export class ExperimentIsolationController {
  constructor(
    private readonly provisionSession: ProvisionExperimentSessionUseCase,
    private readonly getSession: GetExperimentSessionUseCase,
    private readonly teardownSession: TeardownExperimentSessionUseCase,
  ) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Provision or reuse an isolated experiment session' })
  async provision(
    @Body() dto: ProvisionExperimentSessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.provisionSession.execute({
      clientSessionToken: dto.clientSessionToken,
      trackSlug: dto.trackSlug,
      labSlug: dto.labSlug,
      dataset: dto.dataset,
      context: {
        requestId: req.headers['x-request-id'] as string | undefined,
        userId: req.user?.sub,
      },
    });

    return result;
  }

  @Public()
  @Get(':sessionId')
  @ApiOperation({ summary: 'Get experiment session status' })
  @ApiParam({ name: 'sessionId', type: String })
  async getById(@Param() params: ExperimentSessionIdParamDto) {
    const session = await this.getSession.execute(params.sessionId);
    return this.toSummary(session);
  }

  @Public()
  @Delete(':sessionId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tear down an experiment session runtime context' })
  @ApiParam({ name: 'sessionId', type: String })
  async teardown(
    @Param() params: ExperimentSessionIdParamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.teardownSession.execute({
      sessionId: params.sessionId,
      context: {
        requestId: req.headers['x-request-id'] as string | undefined,
        userId: req.user?.sub,
      },
    });
  }

  private toSummary(
    session: Awaited<ReturnType<GetExperimentSessionUseCase['execute']>>,
  ): ExperimentSessionSummary {
    return {
      sessionId: session.sessionId,
      status: session.status,
      trackSlug: session.trackSlug,
      labSlug: session.labSlug,
      runtimeAdapter: session.runtimeAdapter,
      schemaName: session.schemaName,
      dataset: {
        ...session.dataset,
        version: session.dataset.version ?? 'v1',
      },
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
    };
  }
}
