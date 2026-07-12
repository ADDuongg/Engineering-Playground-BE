import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@db-play/types';
import { CreateLabCurriculumUseCase } from './create-lab-curriculum.usecase';
import { UpdateLabCurriculumUseCase } from './update-lab-curriculum.usecase';
import { LabRepository } from '../../progress/infrastructure/lab.repository';
import { LabSummaryCurriculumRepository } from '../../labs/infrastructure/lab-summary-curriculum.repository';

const baseCurriculumInput = {
  learningGoal: 'Goal',
  theory: 'Theory',
  recommendedQuery: {
    sql: 'SELECT 1',
    exampleParameters: [] as unknown[],
    paramHints: [] as string[],
    description: 'd',
  },
  dataset: {
    family: 'commerce',
    version: 'v1',
    recommendedTier: ['100k'],
  },
  quizRequired: false,
};

describe('CreateLabCurriculumUseCase', () => {
  let useCase: CreateLabCurriculumUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let curriculumRepository: jest.Mocked<LabSummaryCurriculumRepository>;

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    curriculumRepository = {
      findByLabId: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<LabSummaryCurriculumRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLabCurriculumUseCase,
        { provide: LabRepository, useValue: labRepository },
        {
          provide: LabSummaryCurriculumRepository,
          useValue: curriculumRepository,
        },
      ],
    }).compile();

    useCase = module.get(CreateLabCurriculumUseCase);
  });

  it('creates curriculum', async () => {
    labRepository.findBySlug.mockResolvedValue({
      id: 'lab-1',
      slug: 'demo-lab',
    } as never);
    curriculumRepository.findByLabId.mockResolvedValue(null);
    curriculumRepository.create.mockResolvedValue({
      ...baseCurriculumInput,
      recommendedCreateIndexSql: null,
      recommendedDropIndexSql: null,
      optionalBenchmarkNote: null,
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
      updatedAt: new Date('2026-07-12T00:00:00.000Z'),
    } as never);

    const result = await useCase.execute('demo-lab', baseCurriculumInput);
    expect(result.labSlug).toBe('demo-lab');
    expect(result.learningGoal).toBe('Goal');
  });

  it('throws CONFLICT when curriculum exists', async () => {
    labRepository.findBySlug.mockResolvedValue({
      id: 'lab-1',
      slug: 'demo-lab',
    } as never);
    curriculumRepository.findByLabId.mockResolvedValue({ id: 'c1' } as never);

    await expect(
      useCase.execute('demo-lab', baseCurriculumInput),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });
});

describe('UpdateLabCurriculumUseCase', () => {
  let useCase: UpdateLabCurriculumUseCase;
  let labRepository: jest.Mocked<LabRepository>;
  let curriculumRepository: jest.Mocked<LabSummaryCurriculumRepository>;

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;
    curriculumRepository = {
      findByLabId: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<LabSummaryCurriculumRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateLabCurriculumUseCase,
        { provide: LabRepository, useValue: labRepository },
        {
          provide: LabSummaryCurriculumRepository,
          useValue: curriculumRepository,
        },
      ],
    }).compile();

    useCase = module.get(UpdateLabCurriculumUseCase);
  });

  it('clears nullable field with explicit null and leaves omitted unchanged', async () => {
    labRepository.findBySlug.mockResolvedValue({
      id: 'lab-1',
      slug: 'demo-lab',
    } as never);
    curriculumRepository.findByLabId.mockResolvedValue({
      ...baseCurriculumInput,
      recommendedCreateIndexSql: 'CREATE INDEX x',
      recommendedDropIndexSql: 'DROP INDEX x',
      optionalBenchmarkNote: 'note',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    curriculumRepository.update.mockImplementation(async (_entity, data) =>
      ({
        id: 'c1',
        labId: 'lab-1',
        ...baseCurriculumInput,
        recommendedCreateIndexSql: null,
        recommendedDropIndexSql: 'DROP INDEX x',
        optionalBenchmarkNote: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }) as never,
    );

    const result = await useCase.execute('demo-lab', {
      optionalBenchmarkNote: null,
      recommendedCreateIndexSql: null,
    });

    expect(curriculumRepository.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        optionalBenchmarkNote: null,
        recommendedCreateIndexSql: null,
      }),
    );
    expect(result.optionalBenchmarkNote).toBeNull();
    expect(result.recommendedCreateIndexSql).toBeNull();
  });
});
