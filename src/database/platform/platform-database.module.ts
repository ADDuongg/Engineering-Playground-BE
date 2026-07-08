import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '../../modules/auth/entities/user.entity';
import { RefreshTokenEntity } from '../../modules/auth/entities/refresh-token.entity';
import { TrackEntity } from '../../modules/tracks/entities/track.entity';
import { InitAuthTables1730000000000 } from '../migrations/1730000000000-InitAuthTables';
import { InitTracksTable1730100000000 } from '../migrations/1730100000000-InitTracksTable';

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
        entities: [UserEntity, RefreshTokenEntity, TrackEntity],
        migrations: [InitAuthTables1730000000000, InitTracksTable1730100000000],
        synchronize: false,
        logging: configService.get('app.nodeEnv') === 'development',
        extra: {
          max: configService.get<number>('platformDatabase.poolSize'),
        },
      }),
    }),
    TypeOrmModule.forFeature(
      [UserEntity, RefreshTokenEntity, TrackEntity],
      'platform',
    ),
  ],
  exports: [TypeOrmModule],
})
export class PlatformDatabaseModule {}
