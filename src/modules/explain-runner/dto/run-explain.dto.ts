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
import { DatasetTier, ExplainMode } from '@db-play/types';

class ExplainDatasetDto {
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

class ExplainContextDto {
  @ApiPropertyOptional({ example: 'database-sql' })
  @IsOptional()
  @IsString()
  trackSlug?: string;

  @ApiPropertyOptional({ example: 'explain-analyze' })
  @IsOptional()
  @IsString()
  labSlug?: string;
}

export class RunExplainDto {
  @ApiProperty({ example: 'SELECT count(*) FROM users WHERE id = $1' })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  sql!: string;

  @ApiProperty({ example: [1], type: [Object] })
  @IsArray()
  parameters!: unknown[];

  @ApiProperty({
    enum: ExplainMode,
    example: ExplainMode.EXPLAIN,
    description: 'Use explain_analyze to include actual execution metrics',
  })
  @IsEnum(ExplainMode)
  explainMode!: ExplainMode;

  @ApiProperty({ type: ExplainDatasetDto })
  @ValidateNested()
  @Type(() => ExplainDatasetDto)
  dataset!: ExplainDatasetDto;

  @ApiPropertyOptional({ type: ExplainContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExplainContextDto)
  context?: ExplainContextDto;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Experiment session id for isolated playground scope',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
