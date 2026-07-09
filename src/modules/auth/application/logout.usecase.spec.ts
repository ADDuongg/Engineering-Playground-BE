import { Test, TestingModule } from '@nestjs/testing';
import { LogoutUseCase } from './logout.usecase';
import { RefreshTokenRepository } from '../infrastructure/refresh-token.repository';
import { TokenService } from './token.service';

describe('LogoutUseCase', () => {
  let useCase: LogoutUseCase;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    refreshTokenRepository = {
      create: jest.fn(),
      findValidByHash: jest.fn(),
      revokeById: jest.fn(),
      revokeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenRepository>;

    tokenService = {
      generateTokens: jest.fn(),
      validateRefreshToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
      hashToken: jest.fn().mockReturnValue('hashed-token'),
    } as unknown as jest.Mocked<TokenService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogoutUseCase,
        { provide: RefreshTokenRepository, useValue: refreshTokenRepository },
        { provide: TokenService, useValue: tokenService },
      ],
    }).compile();

    useCase = module.get<LogoutUseCase>(LogoutUseCase);
  });

  it('should revoke a valid refresh token', async () => {
    refreshTokenRepository.findValidByHash.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      user: undefined as never,
    });

    await useCase.execute('refresh-token');

    expect(tokenService.hashToken).toHaveBeenCalledWith('refresh-token');
    expect(refreshTokenRepository.revokeById).toHaveBeenCalledWith('token-1');
  });

  it('should succeed idempotently when refresh token is unknown', async () => {
    refreshTokenRepository.findValidByHash.mockResolvedValue(null);

    await expect(useCase.execute('unknown-token')).resolves.toBeUndefined();
    expect(refreshTokenRepository.revokeById).not.toHaveBeenCalled();
  });
});
