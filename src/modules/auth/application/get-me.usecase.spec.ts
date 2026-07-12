import { Test, TestingModule } from '@nestjs/testing';
import { GetMeUseCase } from './get-me.usecase';
import { UserRepository } from '../infrastructure/user.repository';
import { Role } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';

describe('GetMeUseCase', () => {
  let useCase: GetMeUseCase;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      existsByEmail: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMeUseCase,
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    useCase = module.get<GetMeUseCase>(GetMeUseCase);
  });

  it('should return user profile when user exists', async () => {
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      displayName: 'Test User',
      role: Role.USER,
      updatedBy: null,
      createdAt: new Date('2026-07-08T00:00:00.000Z'),
      updatedAt: new Date(),
      refreshTokens: [],
    });

    const result = await useCase.execute('user-1');

    expect(result.id).toBe('user-1');
    expect(result.email).toBe('test@example.com');
    expect(result.createdAt).toBe('2026-07-08T00:00:00.000Z');
  });

  it('should throw when user does not exist', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing-id')).rejects.toThrow(DomainError);
  });
});
