import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TracksModule } from '../tracks/tracks.module';
import { ProgressModule } from '../progress/progress.module';
import { LabsModule } from '../labs/labs.module';
import { QuizModule } from '../quiz/quiz.module';
import { AdminController } from './admin.controller';
import { AdminTracksController } from './admin-tracks.controller';
import { AdminLabsController } from './admin-labs.controller';
import { AdminLabFlowController } from './admin-lab-flow.controller';
import { AdminQuizController } from './admin-quiz.controller';
import { AdminUsersController } from './admin-users.controller';
import { GetAdminMeUseCase } from './application/get-admin-me.usecase';
import { CreateTrackUseCase } from './application/create-track.usecase';
import { UpdateTrackUseCase } from './application/update-track.usecase';
import { ListAdminTracksUseCase } from './application/list-admin-tracks.usecase';
import { GetAdminTrackUseCase } from './application/get-admin-track.usecase';
import { CreateLabUseCase } from './application/create-lab.usecase';
import { UpdateLabUseCase } from './application/update-lab.usecase';
import { ListAdminLabsUseCase } from './application/list-admin-labs.usecase';
import { GetAdminLabUseCase } from './application/get-admin-lab.usecase';
import { CreateLabGuidedStepUseCase } from './application/create-lab-guided-step.usecase';
import { UpdateLabGuidedStepUseCase } from './application/update-lab-guided-step.usecase';
import { DeleteLabGuidedStepUseCase } from './application/delete-lab-guided-step.usecase';
import { ListLabGuidedStepsUseCase } from './application/list-lab-guided-steps.usecase';
import { GetLabGuidedStepUseCase } from './application/get-lab-guided-step.usecase';
import { ReorderLabGuidedStepsUseCase } from './application/reorder-lab-guided-steps.usecase';
import { CreateLabCurriculumUseCase } from './application/create-lab-curriculum.usecase';
import { UpdateLabCurriculumUseCase } from './application/update-lab-curriculum.usecase';
import { GetLabCurriculumUseCase } from './application/get-lab-curriculum.usecase';
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
import { ListAdminUsersUseCase } from './application/list-admin-users.usecase';
import { GetAdminUserUseCase } from './application/get-admin-user.usecase';
import { UpdateAdminUserRoleUseCase } from './application/update-admin-user-role.usecase';

@Module({
  imports: [AuthModule, TracksModule, ProgressModule, LabsModule, QuizModule],
  controllers: [
    AdminController,
    AdminTracksController,
    AdminLabsController,
    AdminLabFlowController,
    AdminQuizController,
    AdminUsersController,
  ],
  providers: [
    GetAdminMeUseCase,
    CreateTrackUseCase,
    UpdateTrackUseCase,
    ListAdminTracksUseCase,
    GetAdminTrackUseCase,
    CreateLabUseCase,
    UpdateLabUseCase,
    ListAdminLabsUseCase,
    GetAdminLabUseCase,
    CreateLabGuidedStepUseCase,
    UpdateLabGuidedStepUseCase,
    DeleteLabGuidedStepUseCase,
    ListLabGuidedStepsUseCase,
    GetLabGuidedStepUseCase,
    ReorderLabGuidedStepsUseCase,
    CreateLabCurriculumUseCase,
    UpdateLabCurriculumUseCase,
    GetLabCurriculumUseCase,
    CreateLabQuizUseCase,
    UpdateLabQuizUseCase,
    GetAdminLabQuizUseCase,
    DeleteLabQuizUseCase,
    CreateQuizQuestionUseCase,
    UpdateQuizQuestionUseCase,
    DeleteQuizQuestionUseCase,
    CreateQuizOptionUseCase,
    UpdateQuizOptionUseCase,
    DeleteQuizOptionUseCase,
    ReorderQuizQuestionsUseCase,
    ReorderQuizOptionsUseCase,
    ListAdminUsersUseCase,
    GetAdminUserUseCase,
    UpdateAdminUserRoleUseCase,
  ],
})
export class AdminModule {}
