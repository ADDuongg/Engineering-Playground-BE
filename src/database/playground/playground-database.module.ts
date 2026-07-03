import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlaygroundDatabaseService } from './playground-database.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'playground',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        name: 'playground',
        type: 'postgres' as const,
        host: configService.get<string>('playgroundDatabase.host'),
        port: configService.get<number>('playgroundDatabase.port'),
        username: configService.get<string>('playgroundDatabase.username'),
        password: configService.get<string>('playgroundDatabase.password'),
        database: configService.get<string>('playgroundDatabase.database'),
        entities: [],
        synchronize: false,
        logging: configService.get('app.nodeEnv') === 'development',
        extra: {
          max: configService.get<number>('playgroundDatabase.poolSize'),
        },
      }),
    }),
  ],
  providers: [PlaygroundDatabaseService],
  exports: [PlaygroundDatabaseService],
})
export class PlaygroundDatabaseModule {}
