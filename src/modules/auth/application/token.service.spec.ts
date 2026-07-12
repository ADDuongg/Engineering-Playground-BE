import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { RefreshTokenRepository } from '../infrastructure/refresh-token.repository';
import { Role } from '@db-play/types';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    displayName: 'Test User',
    role: Role.USER,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
  };

  beforeEach(async () => {
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-access-token'),
    } as unknown as jest.Mocked<JwtService>;

    refreshTokenRepository = {
      create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      findValidByHash: jest.fn(),
      revokeById: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'jwt.accessExpiresIn') return '15m';
              if (key === 'jwt.refreshExpiresInDays') return 7;
              return defaultValue;
            }),
          },
        },
        { provide: RefreshTokenRepository, useValue: refreshTokenRepository },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('should generate access and refresh tokens', async () => {
    const tokens = await service.generateTokens(mockUser);

    expect(tokens.accessToken).toBe('signed-access-token');
    expect(tokens.refreshToken).toHaveLength(128);
    expect(tokens.expiresIn).toBe(900);
    expect(tokens.tokenType).toBe('Bearer');
    expect(refreshTokenRepository.create).toHaveBeenCalled();
  });

  it('should rotate refresh token by revoking old and issuing new pair', async () => {
    await service.rotateRefreshToken('old-refresh', 'token-1', mockUser);

    expect(refreshTokenRepository.revokeById).toHaveBeenCalledWith('token-1');
    expect(refreshTokenRepository.create).toHaveBeenCalled();
  });

  it('should validate a stored refresh token', async () => {
    refreshTokenRepository.findValidByHash.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: service.hashToken('valid-refresh'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      user: mockUser,
    });

    const result = await service.validateRefreshToken('valid-refresh');

    expect(result?.tokenId).toBe('token-1');
    expect(result?.user.id).toBe('user-1');
  });

  it('should return null for expired refresh token', async () => {
    refreshTokenRepository.findValidByHash.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: service.hashToken('expired-refresh'),
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      createdAt: new Date(),
      user: mockUser,
    });

    const result = await service.validateRefreshToken('expired-refresh');

    expect(result).toBeNull();
    expect(refreshTokenRepository.revokeById).toHaveBeenCalledWith('token-1');
  });
});
