import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetBenchmarkStatusQueryDto {
  @ApiPropertyOptional({
    description: 'Experiment session id for anonymous benchmark status access',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
