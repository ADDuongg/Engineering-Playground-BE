import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  QuizAttemptAnswerSnapshot,
  QuizAttemptEntity,
} from '../entities/quiz-attempt.entity';

@Injectable()
export class QuizAttemptRepository {
  constructor(
    @InjectRepository(QuizAttemptEntity, 'platform')
    private readonly repository: Repository<QuizAttemptEntity>,
  ) {}

  async insert(input: {
    userId: string;
    quizId: string;
    correctCount: number;
    totalQuestions: number;
    percentCorrect: number;
    passed: boolean;
    answersJson: QuizAttemptAnswerSnapshot[];
    attemptedAt: Date;
  }): Promise<QuizAttemptEntity> {
    const entity = this.repository.create(input);
    return this.repository.save(entity);
  }

  async listByUserAndQuiz(
    userId: string,
    quizId: string,
  ): Promise<QuizAttemptEntity[]> {
    return this.repository.find({
      where: { userId, quizId },
      order: { attemptedAt: 'DESC' },
    });
  }

  async hasPassingAttempt(userId: string, quizId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { userId, quizId, passed: true },
    });
    return count > 0;
  }

  async hasPassingAttemptForLab(
    userId: string,
    labId: string,
  ): Promise<boolean> {
    const count = await this.repository
      .createQueryBuilder('attempt')
      .innerJoin('attempt.quiz', 'quiz')
      .where('attempt.user_id = :userId', { userId })
      .andWhere('quiz.lab_id = :labId', { labId })
      .andWhere('attempt.passed = true')
      .getCount();
    return count > 0;
  }

  async countByUserAndQuiz(userId: string, quizId: string): Promise<number> {
    return this.repository.count({ where: { userId, quizId } });
  }
}
