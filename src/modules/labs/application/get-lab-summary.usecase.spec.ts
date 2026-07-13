import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, LabStatus, TrackStatus } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { QuizRepository } from '../../quiz/infrastructure/quiz.repository';
import { LabSummaryCurriculumRepository } from '../infrastructure/lab-summary-curriculum.repository';
import { LabGuidedStepRepository } from '../infrastructure/lab-guided-step.repository';
import { GetLabSummaryUseCase } from './get-lab-summary.usecase';

describe('GetLabSummaryUseCase', () => {
  let useCase: GetLabSummaryUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let curriculumRepository: jest.Mocked<LabSummaryCurriculumRepository>;
  let stepRepository: jest.Mocked<LabGuidedStepRepository>;
  let quizRepository: jest.Mocked<QuizRepository>;

  const activeLab = {
    id: 'lab-1',
    slug: 'index-playground',
    title: 'Index Playground',
    status: LabStatus.ACTIVE,
    track: { id: 'track-1', slug: 'database-sql', status: TrackStatus.ACTIVE },
  };

  const curriculum = {
    learningGoal: 'Understand B-Tree indexes',
    theory: 'Indexes change scan type',
    recommendedQuery: {
      sql: 'SELECT id, email, name FROM users WHERE email = $1',
      exampleParameters: ['user1@example.com'],
      paramHints: ['pass email'],
      description: 'lookup',
    },
    recommendedCreateIndexSql: 'CREATE INDEX idx_users_email ON users (email)',
    recommendedDropIndexSql: 'DROP INDEX idx_users_email',
    quizRequired: true,
    dataset: { family: 'commerce', version: 'v1', recommendedTier: ['100k'] },
    optionalBenchmarkNote: null,
  };

  const steps = [
    {
      displayOrder: 1,
      title: 'Run SQL',
      instruction: 'Run lookup',
      action: 'run_sql' as const,
      payload: {
        recommendedQuery: {
          sql: 'SELECT id, email, name FROM users WHERE email = $1',
          exampleParameters: ['user1@example.com'],
          paramHints: ['pass email'],
          description: 'lookup',
        },
      },
    },
    {
      displayOrder: 2,
      title: 'Explain',
      instruction: 'Explain',
      action: 'run_explain_analyze' as const,
      payload: {
        recommendedQuery: {
          sql: 'SELECT id, email, name FROM users WHERE email = $1',
          exampleParameters: ['user1@example.com'],
          paramHints: ['pass email'],
          description: 'lookup',
        },
      },
    },
    {
      displayOrder: 3,
      title: 'Create index',
      instruction: 'Create',
      action: 'create_index_sql' as const,
      payload: { sql: 'CREATE INDEX idx_users_email ON users (email)' },
    },
  ];

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    curriculumRepository = {
      findByLabId: jest.fn(),
    } as unknown as jest.Mocked<LabSummaryCurriculumRepository>;
    stepRepository = {
      findOrderedByLabId: jest.fn(),
    } as unknown as jest.Mocked<LabGuidedStepRepository>;
    quizRepository = {
      existsByLabId: jest.fn(),
    } as unknown as jest.Mocked<QuizRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetLabSummaryUseCase,
        { provide: LabRepository, useValue: labRepository },
        {
          provide: LabSummaryCurriculumRepository,
          useValue: curriculumRepository,
        },
        { provide: LabGuidedStepRepository, useValue: stepRepository },
        { provide: QuizRepository, useValue: quizRepository },
      ],
    }).compile();

    useCase = module.get(GetLabSummaryUseCase);
  });

  it('returns summary shape from Platform curriculum + steps', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    curriculumRepository.findByLabId.mockResolvedValue(curriculum as never);
    stepRepository.findOrderedByLabId.mockResolvedValue(steps as never);
    quizRepository.existsByLabId.mockResolvedValue(true);

    const result = await useCase.execute('index-playground');

    expect(result.labSlug).toBe('index-playground');
    expect(result.trackSlug).toBe('database-sql');
    expect(result.title).toBe('Index Playground');
    expect(result.learningGoal.length).toBeGreaterThan(10);
    expect(result.guidedSteps.length).toBeGreaterThanOrEqual(3);
    expect(result.guidedSteps[0].order).toBe(1);
    expect(result.guidedSteps[0].payload?.recommendedQuery?.sql).toMatch(
      /users/i,
    );
    expect(result.guidedSteps[2].payload?.sql).toMatch(/CREATE INDEX/i);
    expect(result.recommendedQuery.sql).toMatch(/users/i);
    expect(result.recommendedQuery.exampleParameters).toEqual([
      'user1@example.com',
    ]);
    expect(result.recommendedCreateIndexSql).toMatch(/users\s*\(\s*email\s*\)/i);
    expect(result.quizRequired).toBe(true);
    expect(result.dataset?.family).toBe('commerce');
  });

  it('derives top-level SQL from step payloads over curriculum when present', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    curriculumRepository.findByLabId.mockResolvedValue({
      ...curriculum,
      recommendedQuery: {
        sql: 'SELECT 1',
        exampleParameters: [],
        paramHints: [],
        description: 'fallback',
      },
      recommendedCreateIndexSql: 'CREATE INDEX from_curriculum',
    } as never);
    stepRepository.findOrderedByLabId.mockResolvedValue(steps as never);
    quizRepository.existsByLabId.mockResolvedValue(true);

    const result = await useCase.execute('index-playground');
    expect(result.recommendedQuery.sql).toMatch(/users/i);
    expect(result.recommendedCreateIndexSql).toMatch(/idx_users_email/i);
  });

  it('allows empty guidedSteps when curriculum exists', async () => {
    labRepository.findBySlug.mockResolvedValue(activeLab as never);
    curriculumRepository.findByLabId.mockResolvedValue(curriculum as never);
    stepRepository.findOrderedByLabId.mockResolvedValue([]);
    quizRepository.existsByLabId.mockResolvedValue(false);

    const result = await useCase.execute('index-playground');
    expect(result.guidedSteps).toEqual([]);
  });

  it('throws NOT_FOUND for unknown lab', async () => {
    labRepository.findBySlug.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('throws NOT_FOUND when curriculum is missing (no registry fallback)', async () => {
    labRepository.findBySlug.mockResolvedValue({
      ...activeLab,
      slug: 'explain-analyze',
      title: 'Explain Analyze Lab',
    } as never);
    curriculumRepository.findByLabId.mockResolvedValue(null);

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

  it('throws FORBIDDEN for coming-soon lab', async () => {
    labRepository.findBySlug.mockResolvedValue({
      ...activeLab,
      status: LabStatus.COMING_SOON,
    } as never);

    await expect(useCase.execute('index-playground')).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
      message: expect.stringContaining('coming soon'),
    });
  });
});
