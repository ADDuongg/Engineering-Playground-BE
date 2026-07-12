import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, LabStatus, TrackStatus } from '@db-play/types';
import { ListAdminTracksUseCase } from './list-admin-tracks.usecase';
import { GetAdminTrackUseCase } from './get-admin-track.usecase';
import { ListAdminLabsUseCase } from './list-admin-labs.usecase';
import { GetAdminLabUseCase } from './get-admin-lab.usecase';
import { TrackRepository } from '../../tracks/infrastructure/track.repository';
import { LabRepository } from '../../progress/infrastructure/lab.repository';

describe('Admin list/get catalog use cases', () => {
  let listTracks: ListAdminTracksUseCase;
  let getTrack: GetAdminTrackUseCase;
  let listLabs: ListAdminLabsUseCase;
  let getLab: GetAdminLabUseCase;
  let trackRepository: jest.Mocked<TrackRepository>;
  let labRepository: jest.Mocked<LabRepository>;

  const track = {
    id: 't1',
    slug: 'database-sql',
    name: 'Database',
    description: 'd',
    status: TrackStatus.ACTIVE,
    displayOrder: 1,
    runtimeAdapterType: 'playground_postgresql',
    inputSurfaceType: 'sql_editor',
    metricCatalogId: 'database-metrics',
    visualizationKitId: 'database-viz',
    createdAt: new Date('2026-07-12T00:00:00.000Z'),
    updatedAt: new Date('2026-07-12T00:00:00.000Z'),
  };

  const lab = {
    id: 'l1',
    slug: 'index-playground',
    title: 'Index',
    description: null,
    sequenceOrder: 1,
    status: LabStatus.ACTIVE,
    track: { slug: 'database-sql' },
    createdAt: new Date('2026-07-12T00:00:00.000Z'),
    updatedAt: new Date('2026-07-12T00:00:00.000Z'),
  };

  beforeEach(async () => {
    trackRepository = {
      findAllOrdered: jest.fn(),
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<TrackRepository>;
    labRepository = {
      findOrderedByTrackId: jest.fn(),
      findBySlug: jest.fn(),
    } as unknown as jest.Mocked<LabRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListAdminTracksUseCase,
        GetAdminTrackUseCase,
        ListAdminLabsUseCase,
        GetAdminLabUseCase,
        { provide: TrackRepository, useValue: trackRepository },
        { provide: LabRepository, useValue: labRepository },
      ],
    }).compile();

    listTracks = module.get(ListAdminTracksUseCase);
    getTrack = module.get(GetAdminTrackUseCase);
    listLabs = module.get(ListAdminLabsUseCase);
    getLab = module.get(GetAdminLabUseCase);
  });

  it('lists tracks', async () => {
    trackRepository.findAllOrdered.mockResolvedValue([track] as never);
    const result = await listTracks.execute();
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].slug).toBe('database-sql');
  });

  it('gets track or NOT_FOUND', async () => {
    trackRepository.findBySlug.mockResolvedValue(track as never);
    await expect(getTrack.execute('database-sql')).resolves.toMatchObject({
      slug: 'database-sql',
    });
    trackRepository.findBySlug.mockResolvedValue(null);
    await expect(getTrack.execute('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });

  it('lists labs for track', async () => {
    trackRepository.findBySlug.mockResolvedValue(track as never);
    labRepository.findOrderedByTrackId.mockResolvedValue([lab] as never);
    const result = await listLabs.execute('database-sql');
    expect(result.labs[0].slug).toBe('index-playground');
  });

  it('gets lab or NOT_FOUND', async () => {
    labRepository.findBySlug.mockResolvedValue(lab as never);
    await expect(getLab.execute('index-playground')).resolves.toMatchObject({
      slug: 'index-playground',
    });
    labRepository.findBySlug.mockResolvedValue(null);
    await expect(getLab.execute('missing')).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});
