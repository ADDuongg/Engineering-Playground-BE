import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DatasetTier } from '@db-play/types';

class ExperimentDatasetDto {
  @ApiProperty({ example: 'commerce' })
  @IsString()
  family!: string;

  @ApiProperty({ enum: DatasetTier, example: DatasetTier.TIER_100K })
  @IsEnum(DatasetTier)
  tier!: DatasetTier;

  @ApiPropertyOptional({ example: 'v1' })
  @IsOptional()
  @IsString()
  version?: string;
}

class ExperimentContextDto {
  @ApiPropertyOptional({ example: 'database-sql' })
  @IsOptional()
  @IsString()
  trackSlug?: string;

  @ApiPropertyOptional({ example: 'index-playground' })
  @IsOptional()
  @IsString()
  labSlug?: string;
}

export class RunExperimentSqlDto {
  @ApiProperty({ example: 'SELECT count(*) AS cnt FROM users WHERE id = $1' })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  sql!: string;

  @ApiProperty({ example: [1], type: [Object] })
  @IsArray()
  parameters!: unknown[];

  @ApiProperty({ type: ExperimentDatasetDto })
  @ValidateNested()
  @Type(() => ExperimentDatasetDto)
  dataset!: ExperimentDatasetDto;

  @ApiPropertyOptional({ type: ExperimentContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExperimentContextDto)
  context?: ExperimentContextDto;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Experiment session id for isolated playground scope',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
