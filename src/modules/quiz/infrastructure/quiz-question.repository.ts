import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { QuizQuestionType } from '@db-play/types';
import { QuizQuestionEntity } from '../entities/quiz-question.entity';
import { QuizOptionEntity } from '../entities/quiz-option.entity';

export interface CreateOptionInlineData {
  label: string;
  sequenceOrder: number;
  isCorrect: boolean;
}

export interface CreateQuestionWithOptionsData {
  quizId: string;
  prompt: string;
  questionType: QuizQuestionType;
  sequenceOrder: number;
  options: CreateOptionInlineData[];
}

@Injectable()
export class QuizQuestionRepository {
  constructor(
    @InjectRepository(QuizQuestionEntity, 'platform')
    private readonly questionRepository: Repository<QuizQuestionEntity>,
    @InjectRepository(QuizOptionEntity, 'platform')
    private readonly optionRepository: Repository<QuizOptionEntity>,
    @InjectDataSource('platform')
    private readonly dataSource: DataSource,
  ) {}

  async findByIdAndQuizId(
    id: string,
    quizId: string,
  ): Promise<QuizQuestionEntity | null> {
    return this.questionRepository.findOne({
      where: { id, quizId },
      relations: { options: true },
    });
  }

  async findOrderedByQuizId(quizId: string): Promise<QuizQuestionEntity[]> {
    const questions = await this.questionRepository.find({
      where: { quizId },
      relations: { options: true },
      order: { sequenceOrder: 'ASC' },
    });
    for (const question of questions) {
      question.options = [...(question.options ?? [])].sort(
        (a, b) => a.sequenceOrder - b.sequenceOrder,
      );
    }
    return questions;
  }

  async createWithOptions(
    data: CreateQuestionWithOptionsData,
  ): Promise<QuizQuestionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const questionRepo = manager.getRepository(QuizQuestionEntity);
      const optionRepo = manager.getRepository(QuizOptionEntity);

      const question = await questionRepo.save(
        questionRepo.create({
          quizId: data.quizId,
          prompt: data.prompt,
          questionType: data.questionType,
          sequenceOrder: data.sequenceOrder,
        }),
      );

      await optionRepo.save(
        data.options.map((option) =>
          optionRepo.create({
            questionId: question.id,
            label: option.label,
            sequenceOrder: option.sequenceOrder,
            isCorrect: option.isCorrect,
          }),
        ),
      );

      const loaded = await questionRepo.findOne({
        where: { id: question.id },
        relations: { options: true },
      });
      if (loaded?.options) {
        loaded.options = [...loaded.options].sort(
          (a, b) => a.sequenceOrder - b.sequenceOrder,
        );
      }
      return loaded!;
    });
  }

  async updatePromptAndOrder(
    entity: QuizQuestionEntity,
    data: { prompt?: string; sequenceOrder?: number },
  ): Promise<QuizQuestionEntity> {
    if (data.prompt !== undefined) {
      entity.prompt = data.prompt;
    }
    if (data.sequenceOrder !== undefined) {
      entity.sequenceOrder = data.sequenceOrder;
    }
    await this.questionRepository.save(entity);
    return (await this.findByIdAndQuizId(entity.id, entity.quizId))!;
  }

  async delete(entity: QuizQuestionEntity): Promise<void> {
    await this.questionRepository.remove(entity);
  }

  async findOptionByIdAndQuestionId(
    optionId: string,
    questionId: string,
  ): Promise<QuizOptionEntity | null> {
    return this.optionRepository.findOne({
      where: { id: optionId, questionId },
    });
  }

  async findOptionsByQuestionId(
    questionId: string,
  ): Promise<QuizOptionEntity[]> {
    return this.optionRepository.find({
      where: { questionId },
      order: { sequenceOrder: 'ASC' },
    });
  }

  async createOption(
    questionId: string,
    data: CreateOptionInlineData,
  ): Promise<QuizOptionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const optionRepo = manager.getRepository(QuizOptionEntity);

      if (data.isCorrect) {
        await optionRepo.update({ questionId }, { isCorrect: false });
      }

      const saved = await optionRepo.save(
        optionRepo.create({
          questionId,
          label: data.label,
          sequenceOrder: data.sequenceOrder,
          isCorrect: data.isCorrect,
        }),
      );
      return saved;
    });
  }

  async updateOption(
    option: QuizOptionEntity,
    data: Partial<CreateOptionInlineData>,
  ): Promise<QuizOptionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const optionRepo = manager.getRepository(QuizOptionEntity);

      if (data.isCorrect === true) {
        await optionRepo.update(
          { questionId: option.questionId },
          { isCorrect: false },
        );
      }

      if (data.label !== undefined) {
        option.label = data.label;
      }
      if (data.sequenceOrder !== undefined) {
        option.sequenceOrder = data.sequenceOrder;
      }
      if (data.isCorrect !== undefined) {
        option.isCorrect = data.isCorrect;
      }

      return optionRepo.save(option);
    });
  }

  async deleteOption(option: QuizOptionEntity): Promise<void> {
    await this.optionRepository.remove(option);
  }

  async reorderQuestions(
    quizId: string,
    questionIds: string[],
  ): Promise<QuizQuestionEntity[]> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(QuizQuestionEntity);
      for (let i = 0; i < questionIds.length; i += 1) {
        await repo.update(
          { id: questionIds[i], quizId },
          { sequenceOrder: i + 1 },
        );
      }
    });
    return this.findOrderedByQuizId(quizId);
  }

  async reorderOptions(
    questionId: string,
    optionIds: string[],
  ): Promise<QuizOptionEntity[]> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(QuizOptionEntity);
      for (let i = 0; i < optionIds.length; i += 1) {
        await repo.update(
          { id: optionIds[i], questionId },
          { sequenceOrder: i + 1 },
        );
      }
    });
    return this.findOptionsByQuestionId(questionId);
  }
}
