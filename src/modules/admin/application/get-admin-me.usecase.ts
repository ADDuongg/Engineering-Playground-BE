import { Injectable } from '@nestjs/common';
import { UserProfile } from '@db-play/types';
import { GetMeUseCase } from '../../auth/application/get-me.usecase';

@Injectable()
export class GetAdminMeUseCase {
  constructor(private readonly getMeUseCase: GetMeUseCase) {}

  execute(userId: string): Promise<UserProfile> {
    return this.getMeUseCase.execute(userId);
  }
}
