import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetJobStatusQueryDto {
  @ApiPropertyOptional({
    description: 'Experiment session ID for ownership when unauthenticated',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  sessionId?: string;
}
