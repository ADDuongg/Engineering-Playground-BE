import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetBenchmarkMetricHistoryQueryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  sessionId!: string;

  @ApiPropertyOptional({ example: 'benchmark-lab' })
  @IsOptional()
  @IsString()
  labSlug?: string;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
