import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TracksModule } from '../tracks/tracks.module';
import { QuizModule } from '../quiz/quiz.module';
import { LabEntity } from './entities/lab.entity';
import { UserLabCompletionEntity } from './entities/user-lab-completion.entity';
import { LabRepository } from './infrastructure/lab.repository';
import { UserLabCompletionRepository } from './infrastructure/user-lab-completion.repository';
import { CompleteLabUseCase } from './application/complete-lab.usecase';
import { GetLearningPathUseCase } from './application/get-learning-path.usecase';
import { GetTrackProgressUseCase } from './application/get-track-progress.usecase';
import { RecordLabCompletionService } from './application/record-lab-completion.service';
import { ProgressController } from './progress.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LabEntity, UserLabCompletionEntity], 'platform'),
    TracksModule,
    forwardRef(() => QuizModule),
  ],
  controllers: [ProgressController],
  providers: [
    LabRepository,
    UserLabCompletionRepository,
    RecordLabCompletionService,
    CompleteLabUseCase,
    GetLearningPathUseCase,
    GetTrackProgressUseCase,
  ],
  exports: [
    LabRepository,
    UserLabCompletionRepository,
    RecordLabCompletionService,
    CompleteLabUseCase,
    GetLearningPathUseCase,
    GetTrackProgressUseCase,
  ],
})
export class ProgressModule {}
