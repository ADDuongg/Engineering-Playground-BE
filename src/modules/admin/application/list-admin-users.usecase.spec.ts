import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@db-play/types';
import { ListAdminUsersUseCase } from './list-admin-users.usecase';
import { UserRepository } from '../../auth/infrastructure/user.repository';

describe('ListAdminUsersUseCase', () => {
  let useCase: ListAdminUsersUseCase;
  let userRepository: jest.Mocked<Pick<UserRepository, 'findPaginated'>>;

  const userA = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'a@example.com',
    displayName: 'Alice',
    role: Role.USER,
    updatedBy: null,
    passwordHash: 'secret',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };

  const userB = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'b@example.com',
    displayName: 'Bob',
    role: Role.ADMIN,
    updatedBy: null,
    passwordHash: 'secret',
    createdAt: new Date('2026-01-03T00:00:00.000Z'),
    updatedAt: new Date('2026-01-04T00:00:00.000Z'),
  };

  beforeEach(async () => {
    userRepository = {
      findPaginated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListAdminUsersUseCase,
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    useCase = module.get(ListAdminUsersUseCase);
  });

  it('returns paginated users without password hashes', async () => {
    userRepository.findPaginated.mockResolvedValue({
      users: [userA, userB] as never,
      total: 2,
    });

    const result = await useCase.execute({ page: 1, limit: 20 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]).toMatchObject({
      id: userA.id,
      email: userA.email,
      displayName: 'Alice',
      role: Role.USER,
      updatedBy: null,
    });
    expect(result.data?.[0]).not.toHaveProperty('passwordHash');
    expect(result.meta.pagination).toEqual({ page: 1, limit: 20, total: 2 });
    expect(userRepository.findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      q: undefined,
    });
  });

  it('passes search query and defaults page/limit', async () => {
    userRepository.findPaginated.mockResolvedValue({ users: [], total: 0 });

    const result = await useCase.execute({ q: 'alice' });

    expect(result.data).toEqual([]);
    expect(result.meta.pagination).toEqual({ page: 1, limit: 20, total: 0 });
    expect(userRepository.findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      q: 'alice',
    });
  });
});
