import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetBenchmarkMetricsQueryDto {
  @ApiPropertyOptional({
    description: 'Experiment session id for anonymous benchmark metrics access',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
