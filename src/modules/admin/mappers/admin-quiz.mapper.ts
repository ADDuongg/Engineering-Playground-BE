import {
  AdminQuizOptionView,
  AdminQuizQuestionView,
  AdminQuizView,
  QuizQuestionType,
} from '@db-play/types';
import { QuizEntity } from '../../quiz/entities/quiz.entity';
import { QuizQuestionEntity } from '../../quiz/entities/quiz-question.entity';
import { QuizOptionEntity } from '../../quiz/entities/quiz-option.entity';

export class AdminQuizMapper {
  static toOptionView(entity: QuizOptionEntity): AdminQuizOptionView {
    return {
      id: entity.id,
      label: entity.label,
      sequenceOrder: entity.sequenceOrder,
      isCorrect: entity.isCorrect,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  static toQuestionView(entity: QuizQuestionEntity): AdminQuizQuestionView {
    const options = [...(entity.options ?? [])]
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map((option) => AdminQuizMapper.toOptionView(option));

    return {
      id: entity.id,
      prompt: entity.prompt,
      questionType: entity.questionType as QuizQuestionType,
      sequenceOrder: entity.sequenceOrder,
      options,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  static toQuizView(entity: QuizEntity, labSlug: string): AdminQuizView {
    const questions = [...(entity.questions ?? [])]
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map((question) => AdminQuizMapper.toQuestionView(question));

    return {
      id: entity.id,
      labSlug,
      title: entity.title,
      questions,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
