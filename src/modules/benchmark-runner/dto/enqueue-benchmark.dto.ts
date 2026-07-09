import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DatasetTier } from '@db-play/types';

class BenchmarkProfileDto {
  @ApiProperty({ example: 100, enum: [100, 500, 1000, 5000] })
  @IsInt()
  @IsIn([100, 500, 1000, 5000])
  rps!: number;

  @ApiProperty({ example: 10, enum: [10, 30, 60] })
  @IsInt()
  @IsIn([10, 30, 60])
  durationSeconds!: number;
}

class BenchmarkTargetDatasetDto {
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

class BenchmarkTargetDto {
  @ApiProperty({ example: 'SELECT id FROM users LIMIT 10' })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  sql!: string;

  @ApiPropertyOptional({ example: [], type: [Object] })
  @IsOptional()
  @IsArray()
  parameters?: unknown[];

  @ApiProperty({ type: BenchmarkTargetDatasetDto })
  @ValidateNested()
  @Type(() => BenchmarkTargetDatasetDto)
  dataset!: BenchmarkTargetDatasetDto;
}

class BenchmarkContextDto {
  @ApiPropertyOptional({ example: 'database-sql' })
  @IsOptional()
  @IsString()
  trackSlug?: string;

  @ApiPropertyOptional({ example: 'benchmark-lab' })
  @IsOptional()
  @IsString()
  labSlug?: string;
}

export class EnqueueBenchmarkDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  sessionId!: string;

  @ApiProperty({ type: BenchmarkProfileDto })
  @ValidateNested()
  @Type(() => BenchmarkProfileDto)
  profile!: BenchmarkProfileDto;

  @ApiProperty({ type: BenchmarkTargetDto })
  @ValidateNested()
  @Type(() => BenchmarkTargetDto)
  target!: BenchmarkTargetDto;

  @ApiPropertyOptional({ type: BenchmarkContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BenchmarkContextDto)
  context?: BenchmarkContextDto;
}
