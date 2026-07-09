import { LabPathItem, TrackProgressLabItem } from '@db-play/types';
import { LabEntity } from '../entities/lab.entity';

export class ProgressMapper {
  static toPathItem(lab: LabEntity): LabPathItem {
    return {
      slug: lab.slug,
      title: lab.title,
      description: lab.description,
      sequenceOrder: lab.sequenceOrder,
    };
  }

  static toProgressLabItem(
    lab: LabEntity,
    completed: boolean,
  ): TrackProgressLabItem {
    return {
      ...ProgressMapper.toPathItem(lab),
      completed,
    };
  }
}
