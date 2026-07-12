import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode } from '@db-play/types';
import { GetTrackProgressUseCase } from './get-track-progress.usecase';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { LabRepository } from '../infrastructure/lab.repository';
import { UserLabCompletionRepository } from '../infrastructure/user-lab-completion.repository';

describe('GetTrackProgressUseCase', () => {
  let useCase: GetTrackProgressUseCase;
  let trackRepository: jest.Mocked<TrackRepository>;
  let labRepository: jest.Mocked<LabRepository>;
  let completionRepository: jest.Mocked<UserLabCompletionRepository>;

  const track = {
    id: 'track-1',
    slug: 'database-sql',
  };

  const labs = [
    {
      id: 'lab-1',
      slug: 'index-playground',
      title: 'Index Playground',
      description: null,
      sequenceOrder: 1,
      status: 'active',
      trackId: 'track-1',
    },
    {
      id: 'lab-2',
      slug: 'explain-analyze',
      title: 'Explain Analyze Lab',
      description: null,
      sequenceOrder: 2,
      status: 'coming-soon',
      trackId: 'track-1',
    },
  ];

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

    completionRepository = {
      findByUserAndLab: jest.fn(),
      listByUserAndTrackId: jest.fn(),
      createOrGetExisting: jest.fn(),
    } as unknown as jest.Mocked<UserLabCompletionRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTrackProgressUseCase,
        { provide: TrackRepository, useValue: trackRepository },
        { provide: LabRepository, useValue: labRepository },
        { provide: UserLabCompletionRepository, useValue: completionRepository },
      ],
    }).compile();

    useCase = module.get(GetTrackProgressUseCase);
  });

  it('returns zero progress when user has no completions', async () => {
    trackRepository.findBySlug.mockResolvedValue(track as never);
    labRepository.findOrderedByTrackId.mockResolvedValue(labs as never);
    completionRepository.listByUserAndTrackId.mockResolvedValue([]);

    const result = await useCase.execute('user-1', 'database-sql');

    expect(result.completedCount).toBe(0);
    expect(result.percentComplete).toBe(0);
    expect(result.completedLabSlugs).toEqual([]);
    expect(result.labs.every((lab) => lab.completed === false)).toBe(true);
  });

  it('returns partial progress and percent', async () => {
    trackRepository.findBySlug.mockResolvedValue(track as never);
    labRepository.findOrderedByTrackId.mockResolvedValue(labs as never);
    completionRepository.listByUserAndTrackId.mockResolvedValue([
      { labId: 'lab-1' },
    ] as never);

    const result = await useCase.execute('user-1', 'database-sql');

    expect(result.totalLabs).toBe(2);
    expect(result.completedCount).toBe(1);
    expect(result.percentComplete).toBe(50);
    expect(result.completedLabSlugs).toEqual(['index-playground']);
    expect(result.labs[0].completed).toBe(true);
    expect(result.labs[1].completed).toBe(false);
  });

  it('throws NOT_FOUND for unknown track', async () => {
    trackRepository.findBySlug.mockResolvedValue(null);

    await expect(
      useCase.execute('user-1', 'missing-track'),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it('returns 0 percent when track has no labs', async () => {
    trackRepository.findBySlug.mockResolvedValue(track as never);
    labRepository.findOrderedByTrackId.mockResolvedValue([]);
    completionRepository.listByUserAndTrackId.mockResolvedValue([]);

    const result = await useCase.execute('user-1', 'database-sql');

    expect(result.totalLabs).toBe(0);
    expect(result.percentComplete).toBe(0);
  });
});
