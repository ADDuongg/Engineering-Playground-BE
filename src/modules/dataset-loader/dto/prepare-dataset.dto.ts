import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DatasetTier } from '@db-play/types';

class DatasetPreparationContextDto {
  @ApiPropertyOptional({ example: 'index-playground' })
  @IsOptional()
  @IsString()
  labSlug?: string;

  @ApiPropertyOptional({ example: 'database-sql' })
  @IsOptional()
  @IsString()
  trackSlug?: string;
}

export class PrepareDatasetDto {
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

  @ApiPropertyOptional({ type: DatasetPreparationContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DatasetPreparationContextDto)
  context?: DatasetPreparationContextDto;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Experiment session id for isolated playground scope',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
