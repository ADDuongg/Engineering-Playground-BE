import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { LabGuidedStepAction } from '@db-play/types';
import { LabGuidedStepEntity } from '../entities/lab-guided-step.entity';

export interface CreateLabGuidedStepData {
  labId: string;
  displayOrder: number;
  title: string;
  instruction: string;
  action: LabGuidedStepAction;
  payload: Record<string, unknown> | null;
}

export type UpdateLabGuidedStepData = Partial<
  Omit<CreateLabGuidedStepData, 'labId'>
>;

@Injectable()
export class LabGuidedStepRepository {
  constructor(
    @InjectRepository(LabGuidedStepEntity, 'platform')
    private readonly repository: Repository<LabGuidedStepEntity>,
    @InjectDataSource('platform')
    private readonly dataSource: DataSource,
  ) {}

  async findOrderedByLabId(labId: string): Promise<LabGuidedStepEntity[]> {
    return this.repository.find({
      where: { labId },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  async findByIdAndLabId(
    id: string,
    labId: string,
  ): Promise<LabGuidedStepEntity | null> {
    return this.repository.findOne({ where: { id, labId } });
  }

  async countByLabId(labId: string): Promise<number> {
    return this.repository.count({ where: { labId } });
  }

  async create(data: CreateLabGuidedStepData): Promise<LabGuidedStepEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async update(
    entity: LabGuidedStepEntity,
    data: UpdateLabGuidedStepData,
  ): Promise<LabGuidedStepEntity> {
    Object.assign(entity, data);
    return this.repository.save(entity);
  }

  async delete(entity: LabGuidedStepEntity): Promise<void> {
    await this.repository.remove(entity);
  }

  /**
   * Sets displayOrder to 1..N matching stepIds order. Caller must validate set equality.
   */
  async reorder(
    labId: string,
    stepIds: string[],
  ): Promise<LabGuidedStepEntity[]> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(LabGuidedStepEntity);
      for (let i = 0; i < stepIds.length; i += 1) {
        await repo.update(
          { id: stepIds[i], labId },
          { displayOrder: i + 1 },
        );
      }
    });
    return this.findOrderedByLabId(labId);
  }

  async findByIdsAndLabId(
    labId: string,
    ids: string[],
  ): Promise<LabGuidedStepEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.repository.find({
      where: { labId, id: In(ids) },
    });
  }
}
