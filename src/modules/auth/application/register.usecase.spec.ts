import { Test, TestingModule } from '@nestjs/testing';
import { RegisterUseCase } from './register.usecase';
import { UserRepository } from '../infrastructure/user.repository';
import { TokenService } from './token.service';
import { Role } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let userRepository: jest.Mocked<UserRepository>;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
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
        RegisterUseCase,
        { provide: UserRepository, useValue: userRepository },
        { provide: TokenService, useValue: tokenService },
      ],
    }).compile();

    useCase = module.get<RegisterUseCase>(RegisterUseCase);
  });

  it('should register a new user successfully', async () => {
    userRepository.existsByEmail.mockResolvedValue(false);
    userRepository.create.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      passwordHash: 'hashed',
      displayName: 'New User',
      role: Role.USER,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      refreshTokens: [],
    });

    const result = await useCase.execute({
      email: 'new@example.com',
      password: 'password123',
      displayName: 'New User',
    });

    expect(result.user.email).toBe('new@example.com');
    expect(result.tokens.accessToken).toBe('access-token');
    expect(userRepository.create).toHaveBeenCalled();
  });

  it('should throw when email already exists', async () => {
    userRepository.existsByEmail.mockResolvedValue(true);

    await expect(
      useCase.execute({
        email: 'existing@example.com',
        password: 'password123',
        displayName: 'Existing',
      }),
    ).rejects.toThrow(DomainError);
  });
});
