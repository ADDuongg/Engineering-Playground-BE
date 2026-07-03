import { Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from '../infrastructure/refresh-token.repository';
import { TokenService } from './token.service';

@Injectable()
export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const stored =
      await this.refreshTokenRepository.findValidByHash(tokenHash);

    if (stored) {
      await this.refreshTokenRepository.revokeById(stored.id);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllForUser(userId);
  }
}
