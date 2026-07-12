import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LabGuidedStepAction } from '@db-play/types';
import { LabEntity } from '../../progress/entities/lab.entity';

@Entity('lab_guided_steps')
@Index(['labId'])
export class LabGuidedStepEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId!: string;

  @ManyToOne(() => LabEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab!: LabEntity;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder!: number;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  instruction!: string;

  @Column({ type: 'varchar', length: 64 })
  action!: LabGuidedStepAction;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
