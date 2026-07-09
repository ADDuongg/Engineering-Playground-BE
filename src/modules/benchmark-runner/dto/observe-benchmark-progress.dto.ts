import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ObserveBenchmarkProgressQueryDto {
  @ApiPropertyOptional({
    description:
      'Experiment session id for anonymous benchmark progress access',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
