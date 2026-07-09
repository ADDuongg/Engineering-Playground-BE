import { Test, TestingModule } from '@nestjs/testing';
import { LoginUseCase } from './login.usecase';
import { UserRepository } from '../infrastructure/user.repository';
import { TokenService } from './token.service';
import { Role } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import * as argon2 from 'argon2';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let tokenService: jest.Mocked<TokenService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '',
    displayName: 'Test User',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshTokens: [],
  };

  beforeEach(async () => {
    mockUser.passwordHash = await argon2.hash('password123');

    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      existsByEmail: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    tokenService = {
      generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      }),
      validateRefreshToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
      hashToken: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        { provide: UserRepository, useValue: userRepository },
        { provide: TokenService, useValue: tokenService },
      ],
    }).compile();

    useCase = module.get<LoginUseCase>(LoginUseCase);
  });

  it('should login successfully with valid credentials', async () => {
    userRepository.findByEmail.mockResolvedValue(mockUser);

    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.user.email).toBe('test@example.com');
    expect(result.tokens.accessToken).toBe('access-token');
    expect(tokenService.generateTokens).toHaveBeenCalledWith(mockUser);
    expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('should normalize email to lowercase before lookup', async () => {
    userRepository.findByEmail.mockResolvedValue(mockUser);

    await useCase.execute({
      email: 'Test@Example.COM',
      password: 'password123',
    });

    expect(userRepository.findByEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('should throw when user not found', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toThrow(DomainError);
  });

  it('should throw when password is invalid', async () => {
    userRepository.findByEmail.mockResolvedValue(mockUser);

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'wrongpassword' }),
    ).rejects.toThrow(DomainError);
  });
});
