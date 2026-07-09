import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetricContractDto {
  @ApiProperty({ example: 'execution_time_ms' })
  key!: string;

  @ApiProperty({ example: 'Execution Time' })
  label!: string;

  @ApiProperty({ example: 'ms' })
  unit!: string;

  @ApiProperty({ example: 12.5 })
  value!: number;

  @ApiProperty({ example: 'performance' })
  group!: string;
}

export class ExperimentRunResultDto {
  @ApiProperty({ type: [MetricContractDto] })
  metrics!: MetricContractDto[];

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Metric snapshot id for history correlation',
  })
  runId!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Catalog keys omitted due to insufficient source data',
  })
  omittedMetricKeys?: string[];
}

export class ExplainRunResultDto {
  @ApiProperty({ type: [MetricContractDto] })
  metrics!: MetricContractDto[];

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Metric snapshot id for history correlation',
  })
  runId!: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Catalog keys omitted due to insufficient source data',
  })
  omittedMetricKeys?: string[];
}
