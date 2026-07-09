import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DatasetTier } from '@db-play/types';

class ExperimentSessionDatasetDto {
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

export class ProvisionExperimentSessionDto {
  @ApiProperty({ example: 'demo-client-abc' })
  @IsString()
  @MinLength(1)
  clientSessionToken!: string;

  @ApiProperty({ example: 'database-sql' })
  @IsString()
  trackSlug!: string;

  @ApiProperty({ example: 'index-playground' })
  @IsString()
  labSlug!: string;

  @ApiProperty({ type: ExperimentSessionDatasetDto })
  @ValidateNested()
  @Type(() => ExperimentSessionDatasetDto)
  dataset!: ExperimentSessionDatasetDto;
}

export class ExperimentSessionIdParamDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  sessionId!: string;
}
