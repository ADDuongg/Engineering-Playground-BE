import { Test, TestingModule } from '@nestjs/testing';
import { ErrorCode, Role } from '@db-play/types';
import { UpdateAdminUserRoleUseCase } from './update-admin-user-role.usecase';
import { UserRepository } from '../../auth/infrastructure/user.repository';

describe('UpdateAdminUserRoleUseCase', () => {
  let useCase: UpdateAdminUserRoleUseCase;
  let userRepository: jest.Mocked<
    Pick<UserRepository, 'updateRoleWithLastAdminGuard'>
  >;

  const actingAdminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = '11111111-1111-4111-8111-111111111111';

  const baseUser = {
    id: userId,
    email: 'learner@example.com',
    displayName: 'Learner',
    role: Role.USER,
    updatedBy: null as string | null,
    passwordHash: 'secret',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    userRepository = {
      updateRoleWithLastAdminGuard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateAdminUserRoleUseCase,
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    useCase = module.get(UpdateAdminUserRoleUseCase);
  });

  it('promotes user to admin and stamps updatedBy', async () => {
    userRepository.updateRoleWithLastAdminGuard.mockResolvedValue({
      kind: 'ok',
      changed: true,
      user: {
        ...baseUser,
        role: Role.ADMIN,
        updatedBy: actingAdminId,
        updatedAt: new Date('2026-07-12T00:00:00.000Z'),
      } as never,
    });

    const result = await useCase.execute(userId, Role.ADMIN, actingAdminId);

    expect(result.role).toBe(Role.ADMIN);
    expect(result.updatedBy).toBe(actingAdminId);
    expect(result).not.toHaveProperty('passwordHash');
    expect(userRepository.updateRoleWithLastAdminGuard).toHaveBeenCalledWith({
      userId,
      newRole: Role.ADMIN,
      actingAdminId,
    });
  });

  it('returns current view on same-role no-op', async () => {
    userRepository.updateRoleWithLastAdminGuard.mockResolvedValue({
      kind: 'ok',
      changed: false,
      user: baseUser as never,
    });

    const result = await useCase.execute(userId, Role.USER, actingAdminId);

    expect(result.role).toBe(Role.USER);
    expect(result.updatedBy).toBeNull();
  });

  it('throws CONFLICT for last-admin demotion', async () => {
    userRepository.updateRoleWithLastAdminGuard.mockResolvedValue({
      kind: 'last_admin',
    });

    await expect(
      useCase.execute(userId, Role.USER, actingAdminId),
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      message: 'Cannot demote the last remaining admin.',
    });
  });

  it('throws NOT_FOUND when target missing', async () => {
    userRepository.updateRoleWithLastAdminGuard.mockResolvedValue({
      kind: 'not_found',
    });

    await expect(
      useCase.execute(userId, Role.ADMIN, actingAdminId),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});
