import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module';
import { QuizModule } from '../quiz/quiz.module';
import { GetLabSummaryUseCase } from './application/get-lab-summary.usecase';
import { LabSummaryRegistry } from './infrastructure/lab-summary.registry';
import { LabsController } from './labs.controller';

@Module({
  imports: [ProgressModule, QuizModule],
  controllers: [LabsController],
  providers: [LabSummaryRegistry, GetLabSummaryUseCase],
  exports: [GetLabSummaryUseCase, LabSummaryRegistry],
})
export class LabsModule {}
