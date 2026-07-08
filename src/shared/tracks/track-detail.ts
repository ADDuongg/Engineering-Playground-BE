import { InputSurfaceType } from './input-surface-type.enum';
import { RuntimeAdapterType } from './runtime-adapter-type.enum';
import { TrackStatus } from './track-status.enum';

export interface TrackDetail {
  slug: string;
  name: string;
  description: string;
  status: TrackStatus;
  displayOrder: number;
  runtimeAdapterType: RuntimeAdapterType;
  inputSurfaceType: InputSurfaceType;
  metricCatalogId: string;
  visualizationKitId: string;
  isLabStartable: boolean;
}
