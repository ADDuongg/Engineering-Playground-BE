import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BenchmarkProfile, MetricContract } from '@db-play/types';

@Entity('metric_snapshots')
@Index('IDX_metric_snapshots_session_lab_created', [
  'sessionId',
  'labSlug',
  'createdAt',
])
export class MetricSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id', type: 'varchar', length: 128 })
  sessionId!: string;

  @Column({ name: 'lab_slug', type: 'varchar', length: 128, nullable: true })
  labSlug?: string;

  @Column({ name: 'track_slug', type: 'varchar', length: 64, nullable: true })
  trackSlug?: string;

  @Column({ name: 'run_type', type: 'varchar', length: 32 })
  runType!: string;

  @Column({ name: 'dataset_family', type: 'varchar', length: 64 })
  datasetFamily!: string;

  @Column({ name: 'dataset_tier', type: 'varchar', length: 16 })
  datasetTier!: string;

  @Column({ name: 'dataset_version', type: 'varchar', length: 32 })
  datasetVersion!: string;

  @Column({ type: 'jsonb' })
  metrics!: MetricContract[];

  @Column({ name: 'omitted_metric_keys', type: 'jsonb', nullable: true })
  omittedMetricKeys?: string[];

  @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
  requestId?: string;

  @Column({ name: 'job_id', type: 'varchar', length: 128, nullable: true })
  jobId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  profile?: BenchmarkProfile | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
