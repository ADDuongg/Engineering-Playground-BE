import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, Role } from '@db-play/types';
import { GetAdminUserUseCase } from './get-admin-user.usecase';
import { UserRepository } from '../../auth/infrastructure/user.repository';

describe('GetAdminUserUseCase', () => {
  let useCase: GetAdminUserUseCase;
  let userRepository: jest.Mocked<Pick<UserRepository, 'findById'>>;

  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'a@example.com',
    displayName: 'Alice',
    role: Role.USER,
    updatedBy: null,
    passwordHash: 'secret',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(async () => {
    userRepository = { findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAdminUserUseCase,
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    useCase = module.get(GetAdminUserUseCase);
  });

  it('returns admin user view without secrets', async () => {
    userRepository.findById.mockResolvedValue(user as never);

    const result = await useCase.execute(user.id);

    expect(result).toMatchObject({
      id: user.id,
      email: user.email,
      role: Role.USER,
      updatedBy: null,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws NOT_FOUND for missing user', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(user.id)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND,
    });
  });
});
