import { Test, TestingModule } from '@nestjs/testing';
import { GetTrackBySlugUseCase } from './get-track-by-slug.usecase';
import { TrackRepository } from '../infrastructure/track.repository';
import { DomainError } from '../../../common/errors/domain.error';
import {
  InputSurfaceType,
  RuntimeAdapterType,
  TrackStatus,
} from '@db-play/types';

describe('GetTrackBySlugUseCase', () => {
  let useCase: GetTrackBySlugUseCase;
  let trackRepository: jest.Mocked<TrackRepository>;

  const mockTrack = {
    id: '1',
    slug: 'database-sql',
    name: 'Database / SQL',
    description: 'SQL experiments',
    status: TrackStatus.ACTIVE,
    displayOrder: 1,
    runtimeAdapterType: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
    inputSurfaceType: InputSurfaceType.SQL_EDITOR,
    metricCatalogId: 'database-metrics',
    visualizationKitId: 'database-viz',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    trackRepository = {
      findAllOrdered: jest.fn(),
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<TrackRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTrackBySlugUseCase,
        { provide: TrackRepository, useValue: trackRepository },
      ],
    }).compile();

    useCase = module.get<GetTrackBySlugUseCase>(GetTrackBySlugUseCase);
  });

  it('should return track detail with isLabStartable true for active track', async () => {
    trackRepository.findBySlug.mockResolvedValue(mockTrack);

    const result = await useCase.execute('database-sql');

    expect(result.slug).toBe('database-sql');
    expect(result.runtimeAdapterType).toBe(
      RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
    );
    expect(result.isLabStartable).toBe(true);
  });

  it('should return isLabStartable false for coming-soon track', async () => {
    trackRepository.findBySlug.mockResolvedValue({
      ...mockTrack,
      slug: 'caching-concurrency',
      status: TrackStatus.COMING_SOON,
      runtimeAdapterType: RuntimeAdapterType.PLAYGROUND_REDIS,
      inputSurfaceType: InputSurfaceType.COMMAND_PANEL,
    });

    const result = await useCase.execute('caching-concurrency');

    expect(result.isLabStartable).toBe(false);
    expect(result.status).toBe(TrackStatus.COMING_SOON);
  });

  it('should throw NOT_FOUND when track does not exist', async () => {
    trackRepository.findBySlug.mockResolvedValue(null);

    await expect(useCase.execute('unknown-track')).rejects.toThrow(DomainError);
  });
});
