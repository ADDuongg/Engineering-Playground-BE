import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/modules/auth/auth.controller';
import { RegisterUseCase } from '../src/modules/auth/application/register.usecase';
import { LoginUseCase } from '../src/modules/auth/application/login.usecase';
import { RefreshTokenUseCase } from '../src/modules/auth/application/refresh-token.usecase';
import { LogoutUseCase } from '../src/modules/auth/application/logout.usecase';
import { GetMeUseCase } from '../src/modules/auth/application/get-me.usecase';
import { Role } from '@db-play/types';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
} from '../src/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { DomainError } from '../src/common/errors/domain.error';
import { ErrorCode } from '@db-play/types';

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

  const registerUseCase = { execute: jest.fn().mockResolvedValue(mockAuthResponse) };
  const loginUseCase = { execute: jest.fn().mockResolvedValue(mockAuthResponse) };
  const refreshTokenUseCase = {
    execute: jest.fn().mockResolvedValue(mockAuthResponse),
  };
  const logoutUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
  const getMeUseCase = {
    execute: jest.fn().mockResolvedValue(mockAuthResponse.user),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterUseCase, useValue: registerUseCase },
        { provide: LoginUseCase, useValue: loginUseCase },
        { provide: RefreshTokenUseCase, useValue: refreshTokenUseCase },
        { provide: LogoutUseCase, useValue: logoutUseCase },
        { provide: GetMeUseCase, useValue: getMeUseCase },
        Reflector,
        JwtAuthGuard,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalGuards(moduleFixture.get(JwtAuthGuard));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter(), new DomainExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    registerUseCase.execute.mockResolvedValue(mockAuthResponse);
    loginUseCase.execute.mockResolvedValue(mockAuthResponse);
    refreshTokenUseCase.execute.mockResolvedValue(mockAuthResponse);
    logoutUseCase.execute.mockResolvedValue(undefined);
    getMeUseCase.execute.mockResolvedValue(mockAuthResponse.user);
  });

  it('POST /auth/register returns user and tokens', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      })
      .expect(HttpStatus.CREATED)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.user.email).toBe('test@example.com');
        expect(res.body.data.tokens.accessToken).toBe('access-token');
      });
  });

  it('POST /auth/register rejects invalid payload', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
        displayName: 'X',
      })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('POST /auth/login returns user and tokens', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.tokens.accessToken).toBe('access-token');
      });
  });

  it('POST /auth/refresh returns new tokens', () => {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.tokens.accessToken).toBe('access-token');
      });
  });

  it('POST /auth/refresh rejects missing refresh token', () => {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('GET /auth/me returns profile when guard allows request', async () => {
    jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockImplementation((context) => {
        const req = context.switchToHttp().getRequest<{ user: unknown }>();
        req.user = {
          sub: 'user-1',
          email: 'test@example.com',
          role: Role.USER,
        };
        return true;
      });

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer access-token')
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe('test@example.com');
      });
  });

  it('POST /auth/logout returns 204', () => {
    jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockImplementation((context) => {
        const req = context.switchToHttp().getRequest<{ user: unknown }>();
        req.user = {
          sub: 'user-1',
          email: 'test@example.com',
          role: Role.USER,
        };
        return true;
      });

    return request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer access-token')
      .send({ refreshToken: 'refresh-token' })
      .expect(HttpStatus.NO_CONTENT);
  });

  it('maps domain errors to envelope responses', async () => {
    loginUseCase.execute.mockRejectedValue(
      new DomainError(ErrorCode.UNAUTHORIZED, 'Invalid email or password', 401),
    );

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' })
      .expect(HttpStatus.UNAUTHORIZED)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
      });
  });

  it('GET /auth/me returns unauthorized when guard rejects', async () => {
    jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockImplementation(() => {
        throw new UnauthorizedException();
      });

    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(HttpStatus.UNAUTHORIZED)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
      });
  });
});
