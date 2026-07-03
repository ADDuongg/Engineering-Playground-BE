import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/modules/auth/auth.controller';
import { RegisterUseCase } from '../src/modules/auth/application/register.usecase';
import { LoginUseCase } from '../src/modules/auth/application/login.usecase';
import { RefreshTokenUseCase } from '../src/modules/auth/application/refresh-token.usecase';
import { LogoutUseCase } from '../src/modules/auth/application/logout.usecase';
import { GetMeUseCase } from '../src/modules/auth/application/get-me.usecase';
import { Role } from '@db-play/types';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const mockAuthResponse = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      displayName: 'Test User',
      role: Role.USER,
      createdAt: new Date().toISOString(),
    },
    tokens: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
      tokenType: 'Bearer' as const,
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: RegisterUseCase,
          useValue: { execute: jest.fn().mockResolvedValue(mockAuthResponse) },
        },
        {
          provide: LoginUseCase,
          useValue: { execute: jest.fn().mockResolvedValue(mockAuthResponse) },
        },
        {
          provide: RefreshTokenUseCase,
          useValue: { execute: jest.fn().mockResolvedValue(mockAuthResponse) },
        },
        {
          provide: LogoutUseCase,
          useValue: { execute: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: GetMeUseCase,
          useValue: { execute: jest.fn().mockResolvedValue(mockAuthResponse.user) },
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/register returns user and tokens', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe('test@example.com');
        expect(res.body.data.tokens.accessToken).toBe('access-token');
      });
  });

  it('POST /auth/login returns user and tokens', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.tokens.accessToken).toBe('access-token');
      });
  });
});
