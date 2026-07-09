import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../../auth/entities/user.entity';
import { LabEntity } from './lab.entity';

@Entity('user_lab_completions')
@Unique('UQ_user_lab_completions_user_lab', ['userId', 'labId'])
export class UserLabCompletionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId!: string;

  @ManyToOne(() => LabEntity, (lab) => lab.completions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_id' })
  lab!: LabEntity;

  @Column({ name: 'completed_at', type: 'timestamptz' })
  completedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
