import { Test, TestingModule } from '@nestjs/testing';
import {
  ErrorCode,
  RuntimeAdapterType,
  InputSurfaceType,
  TrackStatus,
  VisualizationKitId,
  MetricCatalogId,
} from '@db-play/types';
import { CreateTrackUseCase } from './create-track.usecase';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';

describe('CreateTrackUseCase', () => {
  let useCase: CreateTrackUseCase;
  let trackRepository: jest.Mocked<TrackRepository>;

  const baseInput = {
    slug: 'demo-track',
    name: 'Demo Track',
    description: 'Demo',
    runtimeAdapterType: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
    inputSurfaceType: InputSurfaceType.SQL_EDITOR,
    metricCatalogId: MetricCatalogId.DATABASE,
    visualizationKitId: VisualizationKitId.DATABASE,
  };

  beforeEach(async () => {
    trackRepository = {
      findBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findAllOrdered: jest.fn(),
    } as unknown as jest.Mocked<TrackRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTrackUseCase,
        { provide: TrackRepository, useValue: trackRepository },
      ],
    }).compile();

    useCase = module.get(CreateTrackUseCase);
  });

  it('defaults omitted status to coming-soon', async () => {
    trackRepository.findBySlug.mockResolvedValue(null);
    trackRepository.create.mockResolvedValue({
      id: 't1',
      ...baseInput,
      status: TrackStatus.COMING_SOON,
      displayOrder: 0,
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
      updatedAt: new Date('2026-07-12T00:00:00.000Z'),
    } as never);

    const result = await useCase.execute(baseInput);

    expect(trackRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: TrackStatus.COMING_SOON }),
    );
    expect(result.status).toBe(TrackStatus.COMING_SOON);
  });

  it('throws CONFLICT for duplicate slug', async () => {
    trackRepository.findBySlug.mockResolvedValue({ id: 'existing' } as never);

    await expect(useCase.execute(baseInput)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    });
  });

  it('throws VALIDATION_ERROR for unknown visualization kit', async () => {
    trackRepository.findBySlug.mockResolvedValue(null);

    await expect(
      useCase.execute({
        ...baseInput,
        visualizationKitId: 'unknown-viz',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.VALIDATION_ERROR,
    });
  });
});
