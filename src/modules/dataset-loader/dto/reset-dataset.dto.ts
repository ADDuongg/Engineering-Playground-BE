import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DatasetTier } from '@db-play/types';

class DatasetResetContextDto {
  @ApiPropertyOptional({ example: 'index-playground' })
  @IsOptional()
  @IsString()
  labSlug?: string;
}

export class ResetDatasetDto {
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

  @ApiPropertyOptional({ type: DatasetResetContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DatasetResetContextDto)
  context?: DatasetResetContextDto;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Experiment session id for isolated playground scope',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
