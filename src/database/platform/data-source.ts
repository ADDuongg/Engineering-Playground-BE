import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../modules/auth/entities/user.entity';
import { RefreshTokenEntity } from '../../modules/auth/entities/refresh-token.entity';
import { TrackEntity } from '../../modules/tracks/entities/track.entity';
import { InitAuthTables1730000000000 } from '../migrations/1730000000000-InitAuthTables';
import { InitTracksTable1730100000000 } from '../migrations/1730100000000-InitTracksTable';
import { loadMonorepoEnv } from '../../config/load-env';

loadMonorepoEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.PLATFORM_DB_HOST ?? 'localhost',
  port: parseInt(process.env.PLATFORM_DB_PORT ?? '5434', 10),
  username: process.env.PLATFORM_DB_USER ?? 'platform',
  password: process.env.PLATFORM_DB_PASSWORD ?? 'platform_secret',
  database: process.env.PLATFORM_DB_NAME ?? 'platform_db',
  entities: [UserEntity, RefreshTokenEntity, TrackEntity],
  migrations: [InitAuthTables1730000000000, InitTracksTable1730100000000],
  synchronize: false,
});
