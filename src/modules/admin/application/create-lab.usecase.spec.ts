import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, LabStatus } from '@db-play/types';
import { CreateLabUseCase } from './create-lab.usecase';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { LabRepository } from '../../progress/infrastructure/lab.repository';

describe('CreateLabUseCase', () => {
  let useCase: CreateLabUseCase;
  let trackRepository: jest.Mocked<TrackRepository>;
  let labRepository: jest.Mocked<LabRepository>;

  beforeEach(async () => {
    trackRepository = {
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<TrackRepository>;
    labRepository = {
      findBySlug: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLabUseCase,
        { provide: TrackRepository, useValue: trackRepository },
        { provide: LabRepository, useValue: labRepository },
      ],
    }).compile();

    useCase = module.get(CreateLabUseCase);
  });

  it('defaults omitted status to coming-soon', async () => {
    trackRepository.findBySlug.mockResolvedValue({
      id: 'track-1',
      slug: 'database-sql',
    } as never);
    labRepository.findBySlug.mockResolvedValue(null);
    labRepository.create.mockResolvedValue({
      id: 'lab-1',
      slug: 'demo-lab',
      title: 'Demo Lab',
      description: null,
      sequenceOrder: 1,
      status: LabStatus.COMING_SOON,
      track: { slug: 'database-sql' },
      createdAt: new Date('2026-07-12T00:00:00.000Z'),
      updatedAt: new Date('2026-07-12T00:00:00.000Z'),
    } as never);

    const result = await useCase.execute('database-sql', {
      slug: 'demo-lab',
      title: 'Demo Lab',
      sequenceOrder: 1,
    });

    expect(labRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: LabStatus.COMING_SOON }),
    );
    expect(result.status).toBe(LabStatus.COMING_SOON);
  });

  it('throws NOT_FOUND when track missing', async () => {
    trackRepository.findBySlug.mockResolvedValue(null);

    await expect(
      useCase.execute('missing', {
        slug: 'demo-lab',
        title: 'Demo',
        sequenceOrder: 1,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('throws CONFLICT for duplicate lab slug', async () => {
    trackRepository.findBySlug.mockResolvedValue({
      id: 'track-1',
      slug: 'database-sql',
    } as never);
    labRepository.findBySlug.mockResolvedValue({ id: 'existing' } as never);

    await expect(
      useCase.execute('database-sql', {
        slug: 'index-playground',
        title: 'Dup',
        sequenceOrder: 9,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });
});
