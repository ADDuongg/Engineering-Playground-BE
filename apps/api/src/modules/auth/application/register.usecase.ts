import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { ErrorCode, Role } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { UserRepository } from '../infrastructure/user.repository';
import { TokenService } from './token.service';
import { UserMapper } from '../mappers/user.mapper';
import { RegisterDto } from '../dto/register.dto';
import { AuthResponse } from '@db-play/types';

@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();

    const exists = await this.userRepository.existsByEmail(email);
    if (exists) {
      throw new DomainError(
        ErrorCode.CONFLICT,
        'An account with this email already exists',
        409,
      );
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.userRepository.create({
      email,
      passwordHash,
      displayName: dto.displayName,
      role: Role.USER,
    });

    const tokens = await this.tokenService.generateTokens(user);

    return {
      user: UserMapper.toProfile(user),
      tokens,
    };
  }
}
