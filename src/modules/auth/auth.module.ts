import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { UserEntity } from './entities/user.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { UserRepository } from './infrastructure/user.repository';
import { RefreshTokenRepository } from './infrastructure/refresh-token.repository';
import { TokenService } from './application/token.service';
import { RegisterUseCase } from './application/register.usecase';
import { LoginUseCase } from './application/login.usecase';
import { RefreshTokenUseCase } from './application/refresh-token.usecase';
import { LogoutUseCase } from './application/logout.usecase';
import { GetMeUseCase } from './application/get-me.usecase';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.accessExpiresIn', '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
    TypeOrmModule.forFeature(
      [UserEntity, RefreshTokenEntity],
      'platform',
    ),
  ],
  controllers: [AuthController],
  providers: [
    UserRepository,
    RefreshTokenRepository,
    TokenService,
    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetMeUseCase,
    JwtStrategy,
  ],
  exports: [JwtModule, PassportModule, GetMeUseCase, UserRepository],
})
export class AuthModule {}
