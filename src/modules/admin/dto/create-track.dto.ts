import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  InputSurfaceType,
  RuntimeAdapterType,
  TrackStatus,
} from '@db-play/types';

export class CreateTrackDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsEnum(TrackStatus)
  status?: TrackStatus;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsEnum(RuntimeAdapterType)
  runtimeAdapterType!: RuntimeAdapterType;

  @IsEnum(InputSurfaceType)
  inputSurfaceType!: InputSurfaceType;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  metricCatalogId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  visualizationKitId!: string;
}
