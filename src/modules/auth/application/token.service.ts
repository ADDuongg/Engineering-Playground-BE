import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { AuthTokens } from '@db-play/types';
import { RefreshTokenRepository } from '../infrastructure/refresh-token.repository';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async generateTokens(user: UserEntity): Promise<AuthTokens> {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessExpiresIn = this.configService.get<string>(
      'jwt.accessExpiresIn',
      '15m',
    );

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const refreshExpiresDays = this.configService.get<number>(
      'jwt.refreshExpiresInDays',
      7,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiresDays);

    await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiresInToSeconds(accessExpiresIn),
      tokenType: 'Bearer',
    };
  }

  async rotateRefreshToken(
    refreshToken: string,
    tokenId: string,
    user: UserEntity,
  ): Promise<AuthTokens> {
    await this.refreshTokenRepository.revokeById(tokenId);
    return this.generateTokens(user);
  }

  async validateRefreshToken(
    refreshToken: string,
  ): Promise<{ user: UserEntity; tokenId: string } | null> {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findValidByHash(tokenHash);

    if (!stored || !stored.user) {
      return null;
    }

    if (stored.expiresAt < new Date()) {
      await this.refreshTokenRepository.revokeById(stored.id);
      return null;
    }

    return { user: stored.user, tokenId: stored.id };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiresInToSeconds(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }
}
