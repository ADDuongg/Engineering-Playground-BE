import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { QuizEntity } from '../entities/quiz.entity';

export interface CreateQuizData {
  labId: string;
  title: string | null;
}

@Injectable()
export class QuizRepository {
  constructor(
    @InjectRepository(QuizEntity, 'platform')
    private readonly repository: Repository<QuizEntity>,
    @InjectDataSource('platform')
    private readonly dataSource: DataSource,
  ) {}

  async findByLabSlug(labSlug: string): Promise<QuizEntity | null> {
    return this.repository
      .createQueryBuilder('quiz')
      .innerJoinAndSelect('quiz.lab', 'lab')
      .innerJoinAndSelect('lab.track', 'track')
      .leftJoinAndSelect('quiz.questions', 'question')
      .leftJoinAndSelect('question.options', 'option')
      .where('lab.slug = :labSlug', { labSlug })
      .orderBy('question.sequence_order', 'ASC')
      .addOrderBy('option.sequence_order', 'ASC')
      .getOne();
  }

  async findByLabId(labId: string): Promise<QuizEntity | null> {
    return this.repository.findOne({ where: { labId } });
  }

  async findAdminByLabSlug(labSlug: string): Promise<QuizEntity | null> {
    return this.repository
      .createQueryBuilder('quiz')
      .innerJoinAndSelect('quiz.lab', 'lab')
      .leftJoinAndSelect('quiz.questions', 'question')
      .leftJoinAndSelect('question.options', 'option')
      .where('lab.slug = :labSlug', { labSlug })
      .orderBy('question.sequence_order', 'ASC')
      .addOrderBy('option.sequence_order', 'ASC')
      .getOne();
  }

  async existsByLabId(labId: string): Promise<boolean> {
    const count = await this.repository.count({ where: { labId } });
    return count > 0;
  }

  async create(data: CreateQuizData): Promise<QuizEntity> {
    const entity = this.repository.create({
      labId: data.labId,
      title: data.title,
    });
    const saved = await this.repository.save(entity);
    const loaded = await this.findAdminByLabId(saved.labId);
    return loaded ?? saved;
  }

  async findAdminByLabId(labId: string): Promise<QuizEntity | null> {
    return this.repository
      .createQueryBuilder('quiz')
      .innerJoinAndSelect('quiz.lab', 'lab')
      .leftJoinAndSelect('quiz.questions', 'question')
      .leftJoinAndSelect('question.options', 'option')
      .where('quiz.lab_id = :labId', { labId })
      .orderBy('question.sequence_order', 'ASC')
      .addOrderBy('option.sequence_order', 'ASC')
      .getOne();
  }

  async updateTitle(
    entity: QuizEntity,
    title: string | null,
  ): Promise<QuizEntity> {
    entity.title = title;
    await this.repository.save(entity);
    const loaded = await this.findAdminByLabId(entity.labId);
    return loaded ?? entity;
  }

  /**
   * Hard-deletes the quiz row. Questions, options, and attempts cascade via FK.
   * Does not touch lab completion records.
   */
  async delete(entity: QuizEntity): Promise<void> {
    await this.repository.delete(entity.id);
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }
}
