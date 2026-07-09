import { Injectable } from '@nestjs/common';
import {
  QuizGatePort,
} from '../../progress/application/quiz-gate.port';
import { QuizRepository } from '../infrastructure/quiz.repository';
import { QuizAttemptRepository } from '../infrastructure/quiz-attempt.repository';

@Injectable()
export class QuizGateAdapter implements QuizGatePort {
  constructor(
    private readonly quizRepository: QuizRepository,
    private readonly quizAttemptRepository: QuizAttemptRepository,
  ) {}

  async hasQuizForLab(labId: string): Promise<boolean> {
    return this.quizRepository.existsByLabId(labId);
  }

  async hasPassingAttempt(userId: string, labId: string): Promise<boolean> {
    return this.quizAttemptRepository.hasPassingAttemptForLab(userId, labId);
  }
}
