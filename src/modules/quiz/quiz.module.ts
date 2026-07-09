import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressModule } from '../progress/progress.module';
import { QUIZ_GATE_PORT } from '../progress/application/quiz-gate.port';
import { QuizEntity } from './entities/quiz.entity';
import { QuizQuestionEntity } from './entities/quiz-question.entity';
import { QuizOptionEntity } from './entities/quiz-option.entity';
import { QuizAttemptEntity } from './entities/quiz-attempt.entity';
import { QuizRepository } from './infrastructure/quiz.repository';
import { QuizAttemptRepository } from './infrastructure/quiz-attempt.repository';
import { QuizGateAdapter } from './infrastructure/quiz-gate.adapter';
import { GetQuizDefinitionUseCase } from './application/get-quiz-definition.usecase';
import { SubmitQuizUseCase } from './application/submit-quiz.usecase';
import { GetQuizResultUseCase } from './application/get-quiz-result.usecase';
import { QuizController } from './quiz.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [QuizEntity, QuizQuestionEntity, QuizOptionEntity, QuizAttemptEntity],
      'platform',
    ),
    forwardRef(() => ProgressModule),
  ],
  controllers: [QuizController],
  providers: [
    QuizRepository,
    QuizAttemptRepository,
    QuizGateAdapter,
    { provide: QUIZ_GATE_PORT, useExisting: QuizGateAdapter },
    GetQuizDefinitionUseCase,
    SubmitQuizUseCase,
    GetQuizResultUseCase,
  ],
  exports: [
    QuizRepository,
    QuizAttemptRepository,
    QUIZ_GATE_PORT,
  ],
})
export class QuizModule {}
