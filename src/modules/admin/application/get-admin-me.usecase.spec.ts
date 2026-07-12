import { GetMeUseCase } from '../../auth/application/get-me.usecase';
import { GetAdminMeUseCase } from './get-admin-me.usecase';
import { Role, UserProfile } from '@db-play/types';

describe('GetAdminMeUseCase', () => {
  it('delegates to GetMeUseCase', async () => {
    const profile: UserProfile = {
      id: 'u1',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: Role.ADMIN,
      createdAt: new Date().toISOString(),
    };
    const getMeUseCase = {
      execute: jest.fn().mockResolvedValue(profile),
    } as unknown as GetMeUseCase;

    const useCase = new GetAdminMeUseCase(getMeUseCase);
    await expect(useCase.execute('u1')).resolves.toEqual(profile);
    expect(getMeUseCase.execute).toHaveBeenCalledWith('u1');
  });
});
