import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { QuizEntity } from './quiz.entity';
import { QuizOptionEntity } from './quiz-option.entity';

@Entity('quiz_questions')
export class QuizQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId!: string;

  @ManyToOne(() => QuizEntity, (quiz) => quiz.questions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quiz_id' })
  quiz!: QuizEntity;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ name: 'question_type', type: 'varchar', length: 32 })
  questionType!: string;

  @Column({ name: 'sequence_order', type: 'int' })
  sequenceOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => QuizOptionEntity, (option) => option.question)
  options!: QuizOptionEntity[];
}
