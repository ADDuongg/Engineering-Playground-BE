import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, TrackStatus } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { LabSummaryRegistry } from '../infrastructure/lab-summary.registry';
import { INDEX_PLAYGROUND_CONTENT } from '../infrastructure/lab-summary.content';
import { GetLabSummaryUseCase } from './get-lab-summary.usecase';

describe('GetLabSummaryUseCase', () => {
  let useCase: GetLabSummaryUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let labSummaryRegistry: jest.Mocked<LabSummaryRegistry>;
  let quizRepository: jest.Mocked<QuizRepository>;

  const activeLab = {
    id: 'lab-1',
    slug: 'index-playground',
    title: 'Index Playground',
    track: { id: 'track-1', slug: 'database-sql', status: TrackStatus.ACTIVE },
  };

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    labSummaryRegistry = {
      getByLabSlug: jest.fn(),
    } as unknown as jest.Mocked<LabSummaryRegistry>;
    quizRepository = {
      existsByLabId: jest.fn(),
    } as unknown as jest.Mocked<QuizRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetLabSummaryUseCase,
        { provide: LabRepository, useValue: labRepository },
        { provide: LabSummaryRegistry, useValue: labSummaryRegistry },
        { provide: QuizRepository, useValue: quizRepository },
      ],
    }).compile();

    useCase = module.get(GetLabSummaryUseCase);
  });

  it('returns summary shape for index-playground', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    labSummaryRegistry.getByLabSlug.mockReturnValue(INDEX_PLAYGROUND_CONTENT);
    quizRepository.existsByLabId.mockResolvedValue(true);

    const result = await useCase.execute('index-playground');

    expect(result.labSlug).toBe('index-playground');
    expect(result.trackSlug).toBe('database-sql');
    expect(result.title).toBe('Index Playground');
    expect(result.learningGoal.length).toBeGreaterThan(10);
    expect(result.guidedSteps.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendedQuery.sql).toMatch(/users/i);
    expect(result.recommendedQuery.sql).toMatch(/email/i);
    expect(result.recommendedQuery.exampleParameters).toEqual([
      'user1@example.com',
    ]);
    expect(result.recommendedCreateIndexSql).toMatch(/users\s*\(\s*email\s*\)/i);
    expect(result.quizRequired).toBe(true);
    expect(result.dataset.family).toBe('commerce');
  });

  it('throws NOT_FOUND for unknown lab', async () => {
    labRepository.findBySlug.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('throws NOT_FOUND when summary content is missing', async () => {
    labRepository.findBySlug.mockResolvedValue({
      ...activeLab,
      slug: 'explain-analyze',
      title: 'Explain Analyze Lab',
    } as never);
    labSummaryRegistry.getByLabSlug.mockReturnValue(null);

    await expect(useCase.execute('explain-analyze')).rejects.toMatchObject({
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
