import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, TrackStatus, VisualizationKitId } from '@db-play/types';
import { UpdateTrackUseCase } from './update-track.usecase';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';

describe('UpdateTrackUseCase', () => {
  let useCase: UpdateTrackUseCase;
  let trackRepository: jest.Mocked<TrackRepository>;

  const existing = {
    id: 't1',
    slug: 'demo-track',
    name: 'Demo',
    description: 'd',
    status: TrackStatus.COMING_SOON,
    displayOrder: 1,
    runtimeAdapterType: 'playground_postgresql',
    inputSurfaceType: 'sql_editor',
    metricCatalogId: 'database-metrics',
    visualizationKitId: VisualizationKitId.DATABASE,
    createdAt: new Date('2026-07-12T00:00:00.000Z'),
    updatedAt: new Date('2026-07-12T00:00:00.000Z'),
  };

  beforeEach(async () => {
    trackRepository = {
      findBySlug: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findAllOrdered: jest.fn(),
    } as unknown as jest.Mocked<TrackRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateTrackUseCase,
        { provide: TrackRepository, useValue: trackRepository },
      ],
    }).compile();

    useCase = module.get(UpdateTrackUseCase);
  });

  it('updates status to active', async () => {
    trackRepository.findBySlug.mockResolvedValue(existing as never);
    trackRepository.update.mockResolvedValue({
      ...existing,
      status: TrackStatus.ACTIVE,
    } as never);

    const result = await useCase.execute('demo-track', {
      status: TrackStatus.ACTIVE,
    });

    expect(result.status).toBe(TrackStatus.ACTIVE);
  });

  it('throws NOT_FOUND for unknown slug', async () => {
    trackRepository.findBySlug.mockResolvedValue(null);

    await expect(
      useCase.execute('missing', { name: 'x' }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('throws VALIDATION_ERROR for unknown viz kit on update', async () => {
    trackRepository.findBySlug.mockResolvedValue(existing as never);

    await expect(
      useCase.execute('demo-track', { visualizationKitId: 'bad-viz' }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });
});
