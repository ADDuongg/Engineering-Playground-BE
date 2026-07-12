import {
  Body,
  Controller,
  Delete,
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
import {
  AdminLabFlowLabSlugParamDto,
  AdminLabFlowStepIdParamDto,
  CreateLabCurriculumDto,
  CreateLabGuidedStepDto,
  ReorderLabGuidedStepsDto,
  UpdateLabCurriculumDto,
  UpdateLabGuidedStepDto,
} from './dto/lab-flow.dto';
import { CreateLabGuidedStepUseCase } from './application/create-lab-guided-step.usecase';
import { UpdateLabGuidedStepUseCase } from './application/update-lab-guided-step.usecase';
import { DeleteLabGuidedStepUseCase } from './application/delete-lab-guided-step.usecase';
import { ListLabGuidedStepsUseCase } from './application/list-lab-guided-steps.usecase';
import { GetLabGuidedStepUseCase } from './application/get-lab-guided-step.usecase';
import { ReorderLabGuidedStepsUseCase } from './application/reorder-lab-guided-steps.usecase';
import { CreateLabCurriculumUseCase } from './application/create-lab-curriculum.usecase';
import { UpdateLabCurriculumUseCase } from './application/update-lab-curriculum.usecase';
import { GetLabCurriculumUseCase } from './application/get-lab-curriculum.usecase';

@ApiTags('admin-lab-flow')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/labs/:labSlug')
export class AdminLabFlowController {
  constructor(
    private readonly createStep: CreateLabGuidedStepUseCase,
    private readonly updateStep: UpdateLabGuidedStepUseCase,
    private readonly deleteStep: DeleteLabGuidedStepUseCase,
    private readonly listSteps: ListLabGuidedStepsUseCase,
    private readonly getStep: GetLabGuidedStepUseCase,
    private readonly reorderSteps: ReorderLabGuidedStepsUseCase,
    private readonly createCurriculum: CreateLabCurriculumUseCase,
    private readonly updateCurriculum: UpdateLabCurriculumUseCase,
    private readonly getCurriculum: GetLabCurriculumUseCase,
  ) {}

  @Get('steps')
  @ApiOperation({ summary: 'List guided steps for a lab' })
  async listGuidedSteps(@Param() params: AdminLabFlowLabSlugParamDto) {
    return this.listSteps.execute(params.labSlug);
  }

  @Post('steps')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a guided step for a lab' })
  async createGuidedStep(
    @Param() params: AdminLabFlowLabSlugParamDto,
    @Body() body: CreateLabGuidedStepDto,
  ) {
    return this.createStep.execute(params.labSlug, body);
  }

  @Post('steps/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder all guided steps for a lab' })
  async reorderGuidedSteps(
    @Param() params: AdminLabFlowLabSlugParamDto,
    @Body() body: ReorderLabGuidedStepsDto,
  ) {
    return this.reorderSteps.execute(params.labSlug, body);
  }

  @Get('steps/:stepId')
  @ApiOperation({ summary: 'Get a guided step by id' })
  async getGuidedStep(@Param() params: AdminLabFlowStepIdParamDto) {
    return this.getStep.execute(params.labSlug, params.stepId);
  }

  @Patch('steps/:stepId')
  @ApiOperation({ summary: 'Partial update a guided step' })
  async updateGuidedStep(
    @Param() params: AdminLabFlowStepIdParamDto,
    @Body() body: UpdateLabGuidedStepDto,
  ) {
    return this.updateStep.execute(params.labSlug, params.stepId, body);
  }

  @Delete('steps/:stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard delete a guided step' })
  async deleteGuidedStep(@Param() params: AdminLabFlowStepIdParamDto) {
    await this.deleteStep.execute(params.labSlug, params.stepId);
  }

  @Get('curriculum')
  @ApiOperation({ summary: 'Get lab summary curriculum' })
  async getLabCurriculum(@Param() params: AdminLabFlowLabSlugParamDto) {
    return this.getCurriculum.execute(params.labSlug);
  }

  @Post('curriculum')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create lab summary curriculum (conflict if exists)' })
  async createLabCurriculum(
    @Param() params: AdminLabFlowLabSlugParamDto,
    @Body() body: CreateLabCurriculumDto,
  ) {
    return this.createCurriculum.execute(params.labSlug, body);
  }

  @Patch('curriculum')
  @ApiOperation({
    summary:
      'Partial update curriculum (omit unchanged; null clears nullable fields)',
  })
  async updateLabCurriculum(
    @Param() params: AdminLabFlowLabSlugParamDto,
    @Body() body: UpdateLabCurriculumDto,
  ) {
    return this.updateCurriculum.execute(params.labSlug, body);
  }
}
