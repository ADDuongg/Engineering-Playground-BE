import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { RunReactExperimentUseCase } from './application/run-react-experiment.usecase';
import { RunReactExperimentDto } from './dto/run-react-experiment.dto';

@ApiTags('experiments')
@ApiBearerAuth()
@Controller('experiments')
export class ReactExperimentController {
  constructor(
    private readonly runReactExperiment: RunReactExperimentUseCase,
  ) {}

  @Post('react/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute a Frontend React Track headless fixture experiment',
    description:
      'Requires JWT. Runs a built-in fixture allowlisted for the lab and returns react-metrics Metric Contract entries.',
  })
  @ApiOkResponse({ description: 'RuntimeExperimentResult with metrics[]' })
  async runReact(
    @Body() dto: RunReactExperimentDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.runReactExperiment.execute({
      action: dto.action,
      fixtureId: dto.fixtureId,
      labSlug: dto.labSlug,
      trackSlug: dto.trackSlug,
      props: dto.props,
      interactions: dto.interactions,
      options: dto.options
        ? {
            memo: dto.options.memo,
            keyStrategy: dto.options.keyStrategy,
          }
        : undefined,
      componentSource: dto.componentSource,
      userId: user.sub,
      requestId,
    });
  }
}
