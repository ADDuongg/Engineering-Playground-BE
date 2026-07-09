import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, TrackStatus } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../infrastructure/quiz.repository';
import { GetQuizDefinitionUseCase } from './get-quiz-definition.usecase';

describe('GetQuizDefinitionUseCase', () => {
  let useCase: GetQuizDefinitionUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let quizRepository: jest.Mocked<QuizRepository>;

  const activeLab = {
    id: 'lab-1',
    slug: 'index-playground',
    track: { id: 'track-1', slug: 'database-sql', status: TrackStatus.ACTIVE },
  };

  const quizEntity = {
    id: 'quiz-1',
    labId: 'lab-1',
    title: 'Index Playground Quiz',
    lab: activeLab,
    questions: [
      {
        id: 'q1',
        prompt: 'Q1?',
        questionType: 'single_select',
        sequenceOrder: 1,
        options: [
          { id: 'o1', label: 'A', sequenceOrder: 1, isCorrect: true },
          { id: 'o2', label: 'B', sequenceOrder: 2, isCorrect: false },
        ],
      },
    ],
  };

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    quizRepository = {
      findByLabSlug: jest.fn(),
    } as unknown as jest.Mocked<QuizRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetQuizDefinitionUseCase,
        { provide: LabRepository, useValue: labRepository },
        { provide: QuizRepository, useValue: quizRepository },
      ],
    }).compile();

    useCase = module.get(GetQuizDefinitionUseCase);
  });

  it('returns definition without isCorrect flags', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizRepository.findByLabSlug.mockResolvedValue(quizEntity as never);

    const result = await useCase.execute('index-playground');

    expect(result.labSlug).toBe('index-playground');
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].options[0]).toEqual({
      id: 'o1',
      label: 'A',
      sequenceOrder: 1,
    });
    expect(JSON.stringify(result)).not.toContain('isCorrect');
  });

  it('throws NOT_FOUND for unknown lab', async () => {
    labRepository.findBySlug.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('throws NOT_FOUND when lab has no quiz', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    quizRepository.findByLabSlug.mockResolvedValue(null);

    await expect(useCase.execute('index-playground')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('throws FORBIDDEN for inactive track', async () => {
    labRepository.findBySlug.mockResolvedValue({
      ...activeLab,
      track: { ...activeLab.track, status: TrackStatus.COMING_SOON },
    } as never);

    await expect(useCase.execute('index-playground')).rejects.toBeInstanceOf(
      DomainError,
    );
    await expect(useCase.execute('index-playground')).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });
});
