import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuidedSql, LabSummaryDatasetHint } from '@db-play/types';
import { LabSummaryCurriculumEntity } from '../entities/lab-summary-curriculum.entity';

export interface CreateLabCurriculumData {
  labId: string;
  learningGoal: string;
  theory: string;
  recommendedQuery: GuidedSql;
  recommendedCreateIndexSql: string | null;
  recommendedDropIndexSql: string | null;
  dataset: LabSummaryDatasetHint;
  quizRequired: boolean;
  optionalBenchmarkNote: string | null;
}

export type UpdateLabCurriculumData = Partial<
  Omit<CreateLabCurriculumData, 'labId'>
>;

@Injectable()
export class LabSummaryCurriculumRepository {
  constructor(
    @InjectRepository(LabSummaryCurriculumEntity, 'platform')
    private readonly repository: Repository<LabSummaryCurriculumEntity>,
  ) {}

  async findByLabId(labId: string): Promise<LabSummaryCurriculumEntity | null> {
    return this.repository.findOne({ where: { labId } });
  }

  async create(
    data: CreateLabCurriculumData,
  ): Promise<LabSummaryCurriculumEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(
    entity: LabSummaryCurriculumEntity,
    data: UpdateLabCurriculumData,
  ): Promise<LabSummaryCurriculumEntity> {
    Object.assign(entity, data);
    return this.repository.save(entity);
  }
}
