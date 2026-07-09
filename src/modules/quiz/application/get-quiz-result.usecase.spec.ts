import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, TrackStatus } from '@db-play/types';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../infrastructure/quiz.repository';
import { QuizAttemptRepository } from '../infrastructure/quiz-attempt.repository';
import { GetQuizResultUseCase } from './get-quiz-result.usecase';

describe('GetQuizResultUseCase', () => {
  let useCase: GetQuizResultUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let quizRepository: jest.Mocked<QuizRepository>;
  let quizAttemptRepository: jest.Mocked<QuizAttemptRepository>;

  const activeLab = {
    id: 'lab-1',
    slug: 'index-playground',
    track: { id: 'track-1', slug: 'database-sql', status: TrackStatus.ACTIVE },
  };

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    quizRepository = {
      findByLabSlug: jest.fn(),
    } as unknown as jest.Mocked<QuizRepository>;
    quizAttemptRepository = {
      listByUserAndQuiz: jest.fn(),
    } as unknown as jest.Mocked<QuizAttemptRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetQuizResultUseCase,
        { provide: LabRepository, useValue: labRepository },
        { provide: QuizRepository, useValue: quizRepository },
        { provide: QuizAttemptRepository, useValue: quizAttemptRepository },
      ],
    }).compile();

    useCase = module.get(GetQuizResultUseCase);
  });

  it('returns not_attempted when no attempts', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizRepository.findByLabSlug.mockResolvedValue({
      id: 'quiz-1',
      lab: activeLab,
    } as never);
    quizAttemptRepository.listByUserAndQuiz.mockResolvedValue([]);

    const result = await useCase.execute('user-1', 'index-playground');

    expect(result).toEqual({
      labSlug: 'index-playground',
      status: 'not_attempted',
      attemptCount: 0,
    });
  });

  it('returns best score among attempts (tie prefers latest)', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizRepository.findByLabSlug.mockResolvedValue({
      id: 'quiz-1',
      lab: activeLab,
    } as never);
    quizAttemptRepository.listByUserAndQuiz.mockResolvedValue([
      {
        correctCount: 1,
        totalQuestions: 2,
        percentCorrect: 50,
        passed: false,
        attemptedAt: new Date('2026-07-09T09:00:00.000Z'),
      },
      {
        correctCount: 2,
        totalQuestions: 2,
        percentCorrect: 100,
        passed: true,
        attemptedAt: new Date('2026-07-09T10:00:00.000Z'),
      },
      {
        correctCount: 2,
        totalQuestions: 2,
        percentCorrect: 100,
        passed: true,
        attemptedAt: new Date('2026-07-09T11:00:00.000Z'),
      },
    ] as never);

    const result = await useCase.execute('user-1', 'index-playground');

    expect(result.status).toBe('passed');
    expect(result.percentCorrect).toBe(100);
    expect(result.attemptCount).toBe(3);
    expect(result.bestAttemptedAt).toBe('2026-07-09T11:00:00.000Z');
  });

  it('throws NOT_FOUND for unknown lab', async () => {
    labRepository.findBySlug.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', 'missing'),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
