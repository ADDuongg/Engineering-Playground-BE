import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressModule } from '../progress/progress.module';
import { QuizModule } from '../quiz/quiz.module';
import { GetLabSummaryUseCase } from './application/get-lab-summary.usecase';
import { LabSummaryCurriculumEntity } from './entities/lab-summary-curriculum.entity';
import { LabGuidedStepEntity } from './entities/lab-guided-step.entity';
import { LabSummaryCurriculumRepository } from './infrastructure/lab-summary-curriculum.repository';
import { LabGuidedStepRepository } from './infrastructure/lab-guided-step.repository';
import { LabsController } from './labs.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [LabSummaryCurriculumEntity, LabGuidedStepEntity],
      'platform',
    ),
    ProgressModule,
    QuizModule,
  ],
  controllers: [LabsController],
  providers: [
    LabSummaryCurriculumRepository,
    LabGuidedStepRepository,
    GetLabSummaryUseCase,
  ],
  exports: [
    GetLabSummaryUseCase,
    LabSummaryCurriculumRepository,
    LabGuidedStepRepository,
  ],
})
export class LabsModule {}
