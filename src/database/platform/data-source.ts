import 'reflect-metadata';
import { DataSource } from 'typeorm';
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
import { InitAuthTables1730000000000 } from '../migrations/1730000000000-InitAuthTables';
import { InitTracksTable1730100000000 } from '../migrations/1730100000000-InitTracksTable';
import { CreateMetricSnapshotsTable1730200000000 } from '../migrations/1730200000000-CreateMetricSnapshotsTable';
import { ExtendMetricSnapshotsForBenchmark1730300000000 } from '../migrations/1730300000000-ExtendMetricSnapshotsForBenchmark';
import { CreateLabsAndUserLabCompletions1730400000000 } from '../migrations/1730400000000-CreateLabsAndUserLabCompletions';
import { CreateQuizTablesAndSeed1730500000000 } from '../migrations/1730500000000-CreateQuizTablesAndSeed';
import { loadMonorepoEnv } from '../../config/load-env';

loadMonorepoEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.PLATFORM_DB_HOST ?? 'localhost',
  port: parseInt(process.env.PLATFORM_DB_PORT ?? '5434', 10),
  username: process.env.PLATFORM_DB_USER ?? 'platform',
  password: process.env.PLATFORM_DB_PASSWORD ?? 'platform_secret',
  database: process.env.PLATFORM_DB_NAME ?? 'platform_db',
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
  ],
  migrations: [
    InitAuthTables1730000000000,
    InitTracksTable1730100000000,
    CreateMetricSnapshotsTable1730200000000,
    ExtendMetricSnapshotsForBenchmark1730300000000,
    CreateLabsAndUserLabCompletions1730400000000,
    CreateQuizTablesAndSeed1730500000000,
  ],
  synchronize: false,
});
