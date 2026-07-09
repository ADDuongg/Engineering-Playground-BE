import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenUseCase } from './refresh-token.usecase';
import { TokenService } from './token.service';
import { Role } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let tokenService: jest.Mocked<TokenService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    displayName: 'Test User',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
  };

  beforeEach(async () => {
    tokenService = {
      generateTokens: jest.fn(),
      validateRefreshToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
      hashToken: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenUseCase,
        { provide: TokenService, useValue: tokenService },
      ],
    }).compile();

    useCase = module.get<RefreshTokenUseCase>(RefreshTokenUseCase);
  });

  it('should refresh tokens when refresh token is valid', async () => {
    tokenService.validateRefreshToken.mockResolvedValue({
      user: mockUser,
      tokenId: 'token-1',
    });
    tokenService.rotateRefreshToken.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 900,
      tokenType: 'Bearer',
    });

    const result = await useCase.execute('valid-refresh-token');

    expect(result.user.email).toBe('test@example.com');
    expect(result.tokens.accessToken).toBe('new-access');
    expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith(
      'valid-refresh-token',
      'token-1',
      mockUser,
    );
  });

  it('should throw when refresh token is invalid', async () => {
    tokenService.validateRefreshToken.mockResolvedValue(null);

    await expect(useCase.execute('invalid-token')).rejects.toThrow(DomainError);
  });
});
