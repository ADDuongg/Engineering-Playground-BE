import { AdminLabView, AdminTrackView } from '@db-play/types';
import { TrackEntity } from '../../tracks/entities/track.entity';
import { LabEntity } from '../../progress/entities/lab.entity';

export class AdminCatalogMapper {
  static toTrackView(entity: TrackEntity): AdminTrackView {
    return {
      id: entity.id,
      slug: entity.slug,
      name: entity.name,
      description: entity.description,
      status: entity.status,
      displayOrder: entity.displayOrder,
      runtimeAdapterType: entity.runtimeAdapterType,
      inputSurfaceType: entity.inputSurfaceType,
      metricCatalogId: entity.metricCatalogId,
      visualizationKitId: entity.visualizationKitId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  static toLabView(entity: LabEntity): AdminLabView {
    return {
      id: entity.id,
      slug: entity.slug,
      title: entity.title,
      description: entity.description,
      trackSlug: entity.track?.slug ?? '',
      sequenceOrder: entity.sequenceOrder,
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
