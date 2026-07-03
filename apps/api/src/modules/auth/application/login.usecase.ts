import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ErrorCode } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { UserRepository } from '../infrastructure/user.repository';
import { TokenService } from './token.service';
import { UserMapper } from '../mappers/user.mapper';
import { LoginDto } from '../dto/login.dto';
import { AuthResponse } from '@db-play/types';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new DomainError(
        ErrorCode.UNAUTHORIZED,
        'Invalid email or password',
        401,
      );
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new DomainError(
        ErrorCode.UNAUTHORIZED,
        'Invalid email or password',
        401,
      );
    }

    const tokens = await this.tokenService.generateTokens(user);

    return {
      user: UserMapper.toProfile(user),
      tokens,
    };
  }
}
