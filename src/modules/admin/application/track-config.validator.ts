import {
  ErrorCode,
  InputSurfaceType,
  MetricCatalogId,
  RuntimeAdapterType,
  VisualizationKitId,
} from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';

const RUNTIME_ADAPTER_VALUES = new Set(Object.values(RuntimeAdapterType));
const INPUT_SURFACE_VALUES = new Set(Object.values(InputSurfaceType));
const METRIC_CATALOG_VALUES = new Set(Object.values(MetricCatalogId));
const VISUALIZATION_KIT_VALUES = new Set(Object.values(VisualizationKitId));

export class TrackConfigValidator {
  static assertRuntimeAdapterType(value: string): RuntimeAdapterType {
    if (!RUNTIME_ADAPTER_VALUES.has(value as RuntimeAdapterType)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Unknown runtime adapter type',
        400,
        {
          field: 'runtimeAdapterType',
          value,
          allowed: [...RUNTIME_ADAPTER_VALUES],
        },
      );
    }
    return value as RuntimeAdapterType;
  }

  static assertInputSurfaceType(value: string): InputSurfaceType {
    if (!INPUT_SURFACE_VALUES.has(value as InputSurfaceType)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Unknown input surface type',
        400,
        {
          field: 'inputSurfaceType',
          value,
          allowed: [...INPUT_SURFACE_VALUES],
        },
      );
    }
    return value as InputSurfaceType;
  }

  static assertMetricCatalogId(value: string): string {
    if (!METRIC_CATALOG_VALUES.has(value as MetricCatalogId)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Unknown metric catalog id',
        400,
        {
          field: 'metricCatalogId',
          value,
          allowed: [...METRIC_CATALOG_VALUES],
        },
      );
    }
    return value;
  }

  static assertVisualizationKitId(value: string): string {
    if (!VISUALIZATION_KIT_VALUES.has(value as VisualizationKitId)) {
      throw new DomainError(
        ErrorCode.VALIDATION_ERROR,
        'Unknown visualization kit id',
        400,
        {
          field: 'visualizationKitId',
          value,
          allowed: [...VISUALIZATION_KIT_VALUES],
        },
      );
    }
    return value;
  }

  static assertAll(input: {
    runtimeAdapterType: string;
    inputSurfaceType: string;
    metricCatalogId: string;
    visualizationKitId: string;
  }): {
    runtimeAdapterType: RuntimeAdapterType;
    inputSurfaceType: InputSurfaceType;
    metricCatalogId: string;
    visualizationKitId: string;
  } {
    return {
      runtimeAdapterType: this.assertRuntimeAdapterType(
        input.runtimeAdapterType,
      ),
      inputSurfaceType: this.assertInputSurfaceType(input.inputSurfaceType),
      metricCatalogId: this.assertMetricCatalogId(input.metricCatalogId),
      visualizationKitId: this.assertVisualizationKitId(
        input.visualizationKitId,
      ),
    };
  }
}
