import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  InputSurfaceType,
  RuntimeAdapterType,
  TrackStatus,
} from '@db-play/types';

export class UpdateTrackDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsEnum(TrackStatus)
  status?: TrackStatus;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsEnum(RuntimeAdapterType)
  runtimeAdapterType?: RuntimeAdapterType;

  @IsOptional()
  @IsEnum(InputSurfaceType)
  inputSurfaceType?: InputSurfaceType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  metricCatalogId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  visualizationKitId?: string;
}
