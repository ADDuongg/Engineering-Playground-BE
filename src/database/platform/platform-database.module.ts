import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '../../modules/auth/entities/user.entity';
import { RefreshTokenEntity } from '../../modules/auth/entities/refresh-token.entity';
import { TrackEntity } from '../../modules/tracks/entities/track.entity';
import { MetricSnapshotEntity } from '../../modules/metrics-pipeline/infrastructure/metric-snapshot.entity';
import { LabEntity } from '../../modules/progress/entities/lab.entity';
import { UserLabCompletionEntity } from '../../modules/progress/entities/user-lab-completion.entity';
import { QuizEntity } from '../../modules/quiz/entities/quiz.entity';
import { QuizQuestionEntity } from '../../modules/quiz/entities/quiz-question.entity';
import { QuizOptionEntity } from '../../modules/quiz/entities/quiz-option.entity';
import { QuizAttemptEntity } from '../../modules/quiz/entities/quiz-attempt.entity';
import { LabSummaryCurriculumEntity } from '../../modules/labs/entities/lab-summary-curriculum.entity';
import { LabGuidedStepEntity } from '../../modules/labs/entities/lab-guided-step.entity';
import { InitAuthTables1730000000000 } from '../migrations/1730000000000-InitAuthTables';
import { InitTracksTable1730100000000 } from '../migrations/1730100000000-InitTracksTable';
import { CreateMetricSnapshotsTable1730200000000 } from '../migrations/1730200000000-CreateMetricSnapshotsTable';
import { ExtendMetricSnapshotsForBenchmark1730300000000 } from '../migrations/1730300000000-ExtendMetricSnapshotsForBenchmark';
import { CreateLabsAndUserLabCompletions1730400000000 } from '../migrations/1730400000000-CreateLabsAndUserLabCompletions';
import { CreateQuizTablesAndSeed1730500000000 } from '../migrations/1730500000000-CreateQuizTablesAndSeed';
import { SeedDevUsers1730600000000 } from '../migrations/1730600000000-SeedDevUsers';
import { AddLabStatusAndBackfill1730700000000 } from '../migrations/1730700000000-AddLabStatusAndBackfill';
import { CreateLabFlowTablesAndSeedIndexPlayground1730800000000 } from '../migrations/1730800000000-CreateLabFlowTablesAndSeedIndexPlayground';
import { BackfillIndexPlaygroundStepSqlPayloads1730900000000 } from '../migrations/1730900000000-BackfillIndexPlaygroundStepSqlPayloads';
import { AddUserUpdatedBy1731000000000 } from '../migrations/1731000000000-AddUserUpdatedBy';

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
        entities: [
          UserEntity,
          RefreshTokenEntity,
          TrackEntity,
          MetricSnapshotEntity,
          LabEntity,
          UserLabCompletionEntity,
          QuizEntity,
          QuizQuestionEntity,
          QuizOptionEntity,
          QuizAttemptEntity,
          LabSummaryCurriculumEntity,
          LabGuidedStepEntity,
        ],
        migrations: [
          InitAuthTables1730000000000,
          InitTracksTable1730100000000,
          CreateMetricSnapshotsTable1730200000000,
          ExtendMetricSnapshotsForBenchmark1730300000000,
          CreateLabsAndUserLabCompletions1730400000000,
          CreateQuizTablesAndSeed1730500000000,
          SeedDevUsers1730600000000,
          AddLabStatusAndBackfill1730700000000,
          CreateLabFlowTablesAndSeedIndexPlayground1730800000000,
          BackfillIndexPlaygroundStepSqlPayloads1730900000000,
          AddUserUpdatedBy1731000000000,
        ],
        synchronize: false,
        logging: configService.get('app.nodeEnv') === 'development',
        extra: {
          max: configService.get<number>('platformDatabase.poolSize'),
        },
      }),
    }),
    TypeOrmModule.forFeature(
      [
        UserEntity,
        RefreshTokenEntity,
        TrackEntity,
        MetricSnapshotEntity,
        LabEntity,
        UserLabCompletionEntity,
        QuizEntity,
        QuizQuestionEntity,
        QuizOptionEntity,
        QuizAttemptEntity,
        LabSummaryCurriculumEntity,
        LabGuidedStepEntity,
      ],
      'platform',
    ),
  ],
  exports: [TypeOrmModule],
})
export class PlatformDatabaseModule {}
