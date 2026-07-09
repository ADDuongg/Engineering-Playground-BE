import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { TrackEntity } from '../../tracks/entities/track.entity';
import { UserLabCompletionEntity } from './user-lab-completion.entity';

@Entity('labs')
export class LabEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'track_id', type: 'uuid' })
  trackId!: string;

  @ManyToOne(() => TrackEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'track_id' })
  track!: TrackEntity;

  @Column({ name: 'sequence_order', type: 'int' })
  sequenceOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => UserLabCompletionEntity, (completion) => completion.lab)
  completions!: UserLabCompletionEntity[];
}
