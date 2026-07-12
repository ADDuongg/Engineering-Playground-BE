import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, LabStatus } from '@db-play/types';
import { UpdateLabUseCase } from './update-lab.usecase';
import { LabRepository } from '../../progress/infrastructure/lab.repository';

describe('UpdateLabUseCase', () => {
  let useCase: UpdateLabUseCase;
  let labRepository: jest.Mocked<LabRepository>;

  const existing = {
    id: 'lab-1',
    slug: 'demo-lab',
    title: 'Demo',
    description: null,
    sequenceOrder: 1,
    status: LabStatus.COMING_SOON,
    track: { slug: 'database-sql' },
    createdAt: new Date('2026-07-12T00:00:00.000Z'),
    updatedAt: new Date('2026-07-12T00:00:00.000Z'),
  };

  beforeEach(async () => {
    labRepository = {
      findBySlug: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateLabUseCase,
        { provide: LabRepository, useValue: labRepository },
      ],
    }).compile();

    useCase = module.get(UpdateLabUseCase);
  });

  it('updates status to active', async () => {
    labRepository.findBySlug.mockResolvedValue(existing as never);
    labRepository.update.mockResolvedValue({
      ...existing,
      status: LabStatus.ACTIVE,
    } as never);

    const result = await useCase.execute('demo-lab', {
      status: LabStatus.ACTIVE,
    });

    expect(result.status).toBe(LabStatus.ACTIVE);
  });

  it('throws NOT_FOUND for unknown lab', async () => {
    labRepository.findBySlug.mockResolvedValue(null);

    await expect(
      useCase.execute('missing', { title: 'x' }),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
