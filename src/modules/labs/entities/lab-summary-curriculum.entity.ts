import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GuidedSql, LabSummaryDatasetHint } from '@db-play/types';
import { LabEntity } from '../../progress/entities/lab.entity';

@Entity('lab_summary_curricula')
export class LabSummaryCurriculumEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'lab_id', type: 'uuid', unique: true })
  labId!: string;

  @ManyToOne(() => LabEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab!: LabEntity;

  @Column({ name: 'learning_goal', type: 'text' })
  learningGoal!: string;

  @Column({ type: 'text' })
  theory!: string;

  @Column({ name: 'recommended_query', type: 'jsonb' })
  recommendedQuery!: GuidedSql;

  @Column({ name: 'recommended_create_index_sql', type: 'text', nullable: true })
  recommendedCreateIndexSql!: string | null;

  @Column({ name: 'recommended_drop_index_sql', type: 'text', nullable: true })
  recommendedDropIndexSql!: string | null;

  @Column({ type: 'jsonb' })
  dataset!: LabSummaryDatasetHint;

  @Column({ name: 'quiz_required', type: 'boolean', default: false })
  quizRequired!: boolean;

  @Column({ name: 'optional_benchmark_note', type: 'text', nullable: true })
  optionalBenchmarkNote!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
