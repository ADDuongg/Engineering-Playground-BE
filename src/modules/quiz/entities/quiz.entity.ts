import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { LabEntity } from '../../progress/entities/lab.entity';
import { QuizQuestionEntity } from './quiz-question.entity';
import { QuizAttemptEntity } from './quiz-attempt.entity';

@Entity('quizzes')
export class QuizEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'lab_id', type: 'uuid', unique: true })
  labId!: string;

  @OneToOne(() => LabEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_id' })
  lab!: LabEntity;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => QuizQuestionEntity, (question) => question.quiz)
  questions!: QuizQuestionEntity[];

  @OneToMany(() => QuizAttemptEntity, (attempt) => attempt.quiz)
  attempts!: QuizAttemptEntity[];
}
