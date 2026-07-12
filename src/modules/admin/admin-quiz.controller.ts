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
  AdminQuizLabSlugParamDto,
  AdminQuizOptionIdParamDto,
  AdminQuizQuestionIdParamDto,
  CreateLabQuizDto,
  CreateQuizOptionDto,
  CreateQuizQuestionDto,
  ReorderQuizOptionsDto,
  ReorderQuizQuestionsDto,
  UpdateLabQuizDto,
  UpdateQuizOptionDto,
  UpdateQuizQuestionDto,
} from './dto/quiz-admin.dto';
import { CreateLabQuizUseCase } from './application/create-lab-quiz.usecase';
import { UpdateLabQuizUseCase } from './application/update-lab-quiz.usecase';
import { GetAdminLabQuizUseCase } from './application/get-admin-lab-quiz.usecase';
import { DeleteLabQuizUseCase } from './application/delete-lab-quiz.usecase';
import { CreateQuizQuestionUseCase } from './application/create-quiz-question.usecase';
import { UpdateQuizQuestionUseCase } from './application/update-quiz-question.usecase';
import { DeleteQuizQuestionUseCase } from './application/delete-quiz-question.usecase';
import { CreateQuizOptionUseCase } from './application/create-quiz-option.usecase';
import { UpdateQuizOptionUseCase } from './application/update-quiz-option.usecase';
import { DeleteQuizOptionUseCase } from './application/delete-quiz-option.usecase';
import { ReorderQuizQuestionsUseCase } from './application/reorder-quiz-questions.usecase';
import { ReorderQuizOptionsUseCase } from './application/reorder-quiz-options.usecase';

@ApiTags('admin-quiz')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/labs/:labSlug/quiz')
export class AdminQuizController {
  constructor(
    private readonly createQuiz: CreateLabQuizUseCase,
    private readonly updateQuiz: UpdateLabQuizUseCase,
    private readonly getQuiz: GetAdminLabQuizUseCase,
    private readonly deleteQuiz: DeleteLabQuizUseCase,
    private readonly createQuestion: CreateQuizQuestionUseCase,
    private readonly updateQuestion: UpdateQuizQuestionUseCase,
    private readonly deleteQuestion: DeleteQuizQuestionUseCase,
    private readonly createOption: CreateQuizOptionUseCase,
    private readonly updateOption: UpdateQuizOptionUseCase,
    private readonly deleteOption: DeleteQuizOptionUseCase,
    private readonly reorderQuestions: ReorderQuizQuestionsUseCase,
    private readonly reorderOptions: ReorderQuizOptionsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get admin quiz definition (includes isCorrect)' })
  async getAdminQuiz(@Param() params: AdminQuizLabSlugParamDto) {
    return this.getQuiz.execute(params.labSlug);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create quiz shell for a lab (conflict if exists)' })
  async createLabQuiz(
    @Param() params: AdminQuizLabSlugParamDto,
    @Body() body: CreateLabQuizDto,
  ) {
    return this.createQuiz.execute(params.labSlug, body);
  }

  @Patch()
  @ApiOperation({ summary: 'Partial update quiz title (null clears)' })
  async updateLabQuiz(
    @Param() params: AdminQuizLabSlugParamDto,
    @Body() body: UpdateLabQuizDto,
  ) {
    return this.updateQuiz.execute(params.labSlug, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Hard delete quiz (cascades questions/options/attempts; keeps lab completions)',
  })
  async deleteLabQuiz(@Param() params: AdminQuizLabSlugParamDto) {
    await this.deleteQuiz.execute(params.labSlug);
  }

  @Post('questions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create question with inline options' })
  async createQuizQuestion(
    @Param() params: AdminQuizLabSlugParamDto,
    @Body() body: CreateQuizQuestionDto,
  ) {
    return this.createQuestion.execute(params.labSlug, body);
  }

  @Post('questions/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder all questions for the quiz' })
  async reorderQuizQuestions(
    @Param() params: AdminQuizLabSlugParamDto,
    @Body() body: ReorderQuizQuestionsDto,
  ) {
    return this.reorderQuestions.execute(params.labSlug, body);
  }

  @Patch('questions/:questionId')
  @ApiOperation({ summary: 'Update question prompt/order only' })
  async updateQuizQuestion(
    @Param() params: AdminQuizQuestionIdParamDto,
    @Body() body: UpdateQuizQuestionDto,
  ) {
    return this.updateQuestion.execute(
      params.labSlug,
      params.questionId,
      body,
    );
  }

  @Delete('questions/:questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a question and its options' })
  async deleteQuizQuestion(@Param() params: AdminQuizQuestionIdParamDto) {
    await this.deleteQuestion.execute(params.labSlug, params.questionId);
  }

  @Post('questions/:questionId/options')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an option on a question' })
  async createQuizOption(
    @Param() params: AdminQuizQuestionIdParamDto,
    @Body() body: CreateQuizOptionDto,
  ) {
    return this.createOption.execute(params.labSlug, params.questionId, body);
  }

  @Post('questions/:questionId/options/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder all options for a question' })
  async reorderQuizOptions(
    @Param() params: AdminQuizQuestionIdParamDto,
    @Body() body: ReorderQuizOptionsDto,
  ) {
    return this.reorderOptions.execute(
      params.labSlug,
      params.questionId,
      body,
    );
  }

  @Patch('questions/:questionId/options/:optionId')
  @ApiOperation({ summary: 'Update an option (label/order/correct)' })
  async updateQuizOption(
    @Param() params: AdminQuizOptionIdParamDto,
    @Body() body: UpdateQuizOptionDto,
  ) {
    return this.updateOption.execute(
      params.labSlug,
      params.questionId,
      params.optionId,
      body,
    );
  }

  @Delete('questions/:questionId/options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an option (rejects invalid answer key)' })
  async deleteQuizOption(@Param() params: AdminQuizOptionIdParamDto) {
    await this.deleteOption.execute(
      params.labSlug,
      params.questionId,
      params.optionId,
    );
  }
}
