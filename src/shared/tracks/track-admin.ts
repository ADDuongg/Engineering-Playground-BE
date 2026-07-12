import { InputSurfaceType } from './input-surface-type.enum';
import { LabStatus } from './lab-status.enum';
import { RuntimeAdapterType } from './runtime-adapter-type.enum';
import { TrackStatus } from './track-status.enum';
import { VisualizationKitId } from './visualization-kit-id.enum';
import { MetricCatalogId } from '../metrics/metric-catalog-id.enum';

export interface AdminTrackView {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: TrackStatus;
  displayOrder: number;
  runtimeAdapterType: RuntimeAdapterType;
  inputSurfaceType: InputSurfaceType;
  metricCatalogId: MetricCatalogId | string;
  visualizationKitId: VisualizationKitId | string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTrackRequest {
  slug: string;
  name: string;
  description: string;
  status?: TrackStatus;
  displayOrder?: number;
  runtimeAdapterType: RuntimeAdapterType;
  inputSurfaceType: InputSurfaceType;
  metricCatalogId: MetricCatalogId | string;
  visualizationKitId: VisualizationKitId | string;
}

export interface UpdateTrackRequest {
  name?: string;
  description?: string;
  status?: TrackStatus;
  displayOrder?: number;
  runtimeAdapterType?: RuntimeAdapterType;
  inputSurfaceType?: InputSurfaceType;
  metricCatalogId?: MetricCatalogId | string;
  visualizationKitId?: VisualizationKitId | string;
}

export interface AdminLabView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  trackSlug: string;
  sequenceOrder: number;
  status: LabStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabRequest {
  slug: string;
  title: string;
  description?: string | null;
  sequenceOrder: number;
  status?: LabStatus;
}

export interface UpdateLabRequest {
  title?: string;
  description?: string | null;
  sequenceOrder?: number;
  status?: LabStatus;
}

export interface AdminTrackListResponse {
  tracks: AdminTrackView[];
}

export interface AdminLabListResponse {
  labs: AdminLabView[];
}
