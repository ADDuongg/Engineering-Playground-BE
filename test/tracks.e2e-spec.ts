import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { TracksController } from '../src/modules/tracks/tracks.controller';
import { ListTracksUseCase } from '../src/modules/tracks/application/list-tracks.usecase';
import { GetTrackBySlugUseCase } from '../src/modules/tracks/application/get-track-by-slug.usecase';
import {
  InputSurfaceType,
  RuntimeAdapterType,
  TrackStatus,
} from '@db-play/types';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

describe('Tracks (e2e)', () => {
  let app: INestApplication<App>;

  const mockTracks = {
    tracks: [
      {
        slug: 'database-sql',
        name: 'Database / SQL',
        description: 'SQL experiments',
        status: TrackStatus.ACTIVE,
        displayOrder: 1,
      },
      {
        slug: 'caching-concurrency',
        name: 'Caching & Concurrency',
        description: 'Redis experiments',
        status: TrackStatus.COMING_SOON,
        displayOrder: 2,
      },
      {
        slug: 'frontend-performance',
        name: 'Frontend Performance',
        description: 'React experiments',
        status: TrackStatus.COMING_SOON,
        displayOrder: 3,
      },
    ],
  };

  const mockTrackDetail = {
    slug: 'database-sql',
    name: 'Database / SQL',
    description: 'SQL experiments',
    status: TrackStatus.ACTIVE,
    displayOrder: 1,
    runtimeAdapterType: RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
    inputSurfaceType: InputSurfaceType.SQL_EDITOR,
    metricCatalogId: 'database-metrics',
    visualizationKitId: 'database-viz',
    isLabStartable: true,
  };

  const mockComingSoonDetail = {
    ...mockTrackDetail,
    slug: 'caching-concurrency',
    name: 'Caching & Concurrency',
    status: TrackStatus.COMING_SOON,
    runtimeAdapterType: RuntimeAdapterType.PLAYGROUND_REDIS,
    inputSurfaceType: InputSurfaceType.COMMAND_PANEL,
    metricCatalogId: 'redis-metrics',
    visualizationKitId: 'redis-viz',
    isLabStartable: false,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TracksController],
      providers: [
        {
          provide: ListTracksUseCase,
          useValue: { execute: jest.fn().mockResolvedValue(mockTracks) },
        },
        {
          provide: GetTrackBySlugUseCase,
          useValue: {
            execute: jest.fn().mockImplementation((slug: string) => {
              if (slug === 'database-sql') {
                return Promise.resolve(mockTrackDetail);
              }
              if (slug === 'caching-concurrency') {
                return Promise.resolve(mockComingSoonDetail);
              }
              const { DomainError } = jest.requireActual(
                '../src/common/errors/domain.error',
              );
              const { ErrorCode } = jest.requireActual('@db-play/types');
              return Promise.reject(
                new DomainError(
                  ErrorCode.NOT_FOUND,
                  `Track "${slug}" is not available on this platform.`,
                  404,
                ),
              );
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /tracks returns track catalog without auth', () => {
    return request(app.getHttpServer())
      .get('/tracks')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.tracks).toHaveLength(3);
        expect(res.body.data.tracks[0].slug).toBe('database-sql');
        expect(res.body.data.tracks[0].status).toBe(TrackStatus.ACTIVE);
      });
  });

  it('GET /tracks/database-sql returns full configuration', () => {
    return request(app.getHttpServer())
      .get('/tracks/database-sql')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.runtimeAdapterType).toBe(
          RuntimeAdapterType.PLAYGROUND_POSTGRESQL,
        );
        expect(res.body.data.isLabStartable).toBe(true);
      });
  });

  it('GET /tracks/caching-concurrency returns coming-soon with isLabStartable false', () => {
    return request(app.getHttpServer())
      .get('/tracks/caching-concurrency')
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe(TrackStatus.COMING_SOON);
        expect(res.body.data.isLabStartable).toBe(false);
      });
  });

  it('GET /tracks/unknown-track returns 404 NOT_FOUND', () => {
    return request(app.getHttpServer())
      .get('/tracks/unknown-track')
      .expect(404)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('NOT_FOUND');
      });
  });
});
