import { Test, TestingModule } from '@nestjs/testing';
import { ListTracksUseCase } from './list-tracks.usecase';
import { TrackRepository } from '../infrastructure/track.repository';
import {
  InputSurfaceType,
  RuntimeAdapterType,
  TrackStatus,
} from '@db-play/types';

describe('ListTracksUseCase', () => {
  let useCase: ListTracksUseCase;
  let trackRepository: jest.Mocked<TrackRepository>;

  beforeEach(async () => {
    trackRepository = {
      findAllOrdered: jest.fn(),
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<TrackRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListTracksUseCase,
        { provide: TrackRepository, useValue: trackRepository },
      ],
    }).compile();

    useCase = module.get<ListTracksUseCase>(ListTracksUseCase);
  });

  it('should return ordered track summaries', async () => {
    trackRepository.findAllOrdered.mockResolvedValue([
      {
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
      },
    ]);

    const result = await useCase.execute();

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].slug).toBe('database-sql');
    expect(result.tracks[0].status).toBe(TrackStatus.ACTIVE);
    expect(result.tracks[0]).not.toHaveProperty('runtimeAdapterType');
  });

  it('should return empty list when no tracks exist', async () => {
    trackRepository.findAllOrdered.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.tracks).toEqual([]);
  });
});
