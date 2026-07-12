import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@db-play/types';
import { GetLearningPathUseCase } from './get-learning-path.usecase';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { LabRepository } from '../infrastructure/lab.repository';

describe('GetLearningPathUseCase', () => {
  let useCase: GetLearningPathUseCase;
  let trackRepository: jest.Mocked<TrackRepository>;
  let labRepository: jest.Mocked<LabRepository>;

  beforeEach(async () => {
    trackRepository = {
      findBySlug: jest.fn(),
      findAllOrdered: jest.fn(),
    } as unknown as jest.Mocked<TrackRepository>;

    labRepository = {
      findBySlug: jest.fn(),
      findOrderedByTrackId: jest.fn(),
      findOrderedByTrackSlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetLearningPathUseCase,
        { provide: TrackRepository, useValue: trackRepository },
        { provide: LabRepository, useValue: labRepository },
      ],
    }).compile();

    useCase = module.get(GetLearningPathUseCase);
  });

  it('returns labs in repository order without completed flags', async () => {
    trackRepository.findBySlug.mockResolvedValue({
      id: 'track-1',
      slug: 'database-sql',
    } as never);
    labRepository.findOrderedByTrackId.mockResolvedValue([
      {
        id: 'lab-1',
        slug: 'index-playground',
        title: 'Index Playground',
        description: 'desc',
        sequenceOrder: 1,
        status: 'active',
      },
      {
        id: 'lab-2',
        slug: 'explain-analyze',
        title: 'Explain Analyze Lab',
        description: null,
        sequenceOrder: 2,
        status: 'coming-soon',
      },
    ] as never);

    const result = await useCase.execute('database-sql');

    expect(result.trackSlug).toBe('database-sql');
    expect(result.labs).toHaveLength(2);
    expect(result.labs[0].slug).toBe('index-playground');
    expect(result.labs[0].status).toBe('active');
    expect(result.labs[0]).not.toHaveProperty('completed');
    expect(result.labs[1].sequenceOrder).toBe(2);
    expect(result.labs[1].status).toBe('coming-soon');
  });

  it('returns empty labs when track has none', async () => {
    trackRepository.findBySlug.mockResolvedValue({
      id: 'track-1',
      slug: 'database-sql',
    } as never);
    labRepository.findOrderedByTrackId.mockResolvedValue([]);

    const result = await useCase.execute('database-sql');

    expect(result.labs).toEqual([]);
  });

  it('throws NOT_FOUND for unknown track', async () => {
    trackRepository.findBySlug.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});
