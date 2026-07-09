import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../../auth/entities/user.entity';
import { QuizEntity } from './quiz.entity';

export interface QuizAttemptAnswerSnapshot {
  questionId: string;
  optionId: string;
}

@Entity('quiz_attempts')
export class QuizAttemptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId!: string;

  @ManyToOne(() => QuizEntity, (quiz) => quiz.attempts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quiz_id' })
  quiz!: QuizEntity;

  @Column({ name: 'correct_count', type: 'int' })
  correctCount!: number;

  @Column({ name: 'total_questions', type: 'int' })
  totalQuestions!: number;

  @Column({ name: 'percent_correct', type: 'int' })
  percentCorrect!: number;

  @Column({ type: 'boolean' })
  passed!: boolean;

  @Column({ name: 'answers_json', type: 'jsonb' })
  answersJson!: QuizAttemptAnswerSnapshot[];

  @Column({ name: 'attempted_at', type: 'timestamptz' })
  attemptedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
