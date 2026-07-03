import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '../../modules/auth/entities/user.entity';
import { RefreshTokenEntity } from '../../modules/auth/entities/refresh-token.entity';
import { InitAuthTables1730000000000 } from '../migrations/1730000000000-InitAuthTables';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'platform',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        name: 'platform',
        type: 'postgres' as const,
        host: configService.get<string>('platformDatabase.host'),
        port: configService.get<number>('platformDatabase.port'),
        username: configService.get<string>('platformDatabase.username'),
        password: configService.get<string>('platformDatabase.password'),
        database: configService.get<string>('platformDatabase.database'),
        entities: [UserEntity, RefreshTokenEntity],
        migrations: [InitAuthTables1730000000000],
        synchronize: false,
        logging: configService.get('app.nodeEnv') === 'development',
        extra: {
          max: configService.get<number>('platformDatabase.poolSize'),
        },
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity], 'platform'),
  ],
  exports: [TypeOrmModule],
})
export class PlatformDatabaseModule {}
