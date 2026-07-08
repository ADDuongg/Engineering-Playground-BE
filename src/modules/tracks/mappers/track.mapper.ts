import {
  TrackDetail,
  TrackStatus,
  TrackSummary,
} from '@db-play/types';
import { TrackEntity } from '../entities/track.entity';

export class TrackMapper {
  static toSummary(entity: TrackEntity): TrackSummary {
    return {
      slug: entity.slug,
      name: entity.name,
      description: entity.description,
      status: entity.status,
      displayOrder: entity.displayOrder,
    };
  }

  static toDetail(entity: TrackEntity): TrackDetail {
    return {
      slug: entity.slug,
      name: entity.name,
      description: entity.description,
      status: entity.status,
      displayOrder: entity.displayOrder,
      runtimeAdapterType: entity.runtimeAdapterType,
      inputSurfaceType: entity.inputSurfaceType,
      metricCatalogId: entity.metricCatalogId,
      visualizationKitId: entity.visualizationKitId,
      isLabStartable: entity.status === TrackStatus.ACTIVE,
    };
  }
}
