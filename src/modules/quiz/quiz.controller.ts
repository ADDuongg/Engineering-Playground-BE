import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { GetQuizDefinitionUseCase } from './application/get-quiz-definition.usecase';
import { GetQuizResultUseCase } from './application/get-quiz-result.usecase';
import { SubmitQuizUseCase } from './application/submit-quiz.usecase';
import { QuizLabSlugParamDto } from './dto/quiz-lab-slug.param.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@ApiTags('quizzes')
@ApiBearerAuth()
@Controller('quizzes')
export class QuizController {
  constructor(
    private readonly getQuizDefinitionUseCase: GetQuizDefinitionUseCase,
    private readonly submitQuizUseCase: SubmitQuizUseCase,
    private readonly getQuizResultUseCase: GetQuizResultUseCase,
  ) {}

  @Get('labs/:labSlug')
  @ApiOperation({
    summary: 'Get quiz definition for a lab (no correct answers)',
  })
  async getDefinition(@Param() params: QuizLabSlugParamDto) {
    return this.getQuizDefinitionUseCase.execute(params.labSlug);
  }

  @Post('labs/:labSlug/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit quiz answers, grade, and complete lab on pass',
  })
  async submit(
    @CurrentUser() user: JwtPayload,
    @Param() params: QuizLabSlugParamDto,
    @Body() body: SubmitQuizDto,
  ) {
    return this.submitQuizUseCase.execute(user.sub, params.labSlug, body.answers);
  }

  @Get('labs/:labSlug/result')
  @ApiOperation({
    summary: 'Get current user best quiz result for a lab',
  })
  async getResult(
    @CurrentUser() user: JwtPayload,
    @Param() params: QuizLabSlugParamDto,
  ) {
    return this.getQuizResultUseCase.execute(user.sub, params.labSlug);
  }
}
