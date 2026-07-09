import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizEntity } from '../entities/quiz.entity';

@Injectable()
export class QuizRepository {
  constructor(
    @InjectRepository(QuizEntity, 'platform')
    private readonly repository: Repository<QuizEntity>,
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

  async existsByLabId(labId: string): Promise<boolean> {
    const count = await this.repository.count({ where: { labId } });
    return count > 0;
  }
}
