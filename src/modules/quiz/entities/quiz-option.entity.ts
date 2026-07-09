import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QuizQuestionEntity } from './quiz-question.entity';

@Entity('quiz_options')
export class QuizOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @ManyToOne(() => QuizQuestionEntity, (question) => question.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question!: QuizQuestionEntity;

  @Column({ type: 'text' })
  label!: string;

  @Column({ name: 'sequence_order', type: 'int' })
  sequenceOrder!: number;

  @Column({ name: 'is_correct', type: 'boolean' })
  isCorrect!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
