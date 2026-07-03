import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { TokenService } from './token.service';
import { UserMapper } from '../mappers/user.mapper';
import { AuthResponse } from '@db-play/types';

@Injectable()
export class RefreshTokenUseCase {
  constructor(private readonly tokenService: TokenService) {}

  async execute(refreshToken: string): Promise<AuthResponse> {
    const result = await this.tokenService.validateRefreshToken(refreshToken);

    if (!result) {
      throw new DomainError(
        ErrorCode.UNAUTHORIZED,
        'Invalid or expired refresh token',
        401,
      );
    }

    const tokens = await this.tokenService.rotateRefreshToken(
      refreshToken,
      result.tokenId,
      result.user,
    );

    return {
      user: UserMapper.toProfile(result.user),
      tokens,
    };
  }
}
