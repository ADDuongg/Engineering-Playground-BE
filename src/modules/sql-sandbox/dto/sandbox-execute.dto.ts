import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SandboxContextDto {
  @ApiPropertyOptional({ example: 'database-sql' })
  @IsOptional()
  @IsString()
  trackSlug?: string;

  @ApiPropertyOptional({ example: 'index-playground' })
  @IsOptional()
  @IsString()
  labSlug?: string;
}

export class SandboxExecuteDto {
  @ApiProperty({ example: 'SELECT * FROM users WHERE id = $1' })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  sql!: string;

  @ApiProperty({ example: [1], type: [Object] })
  @IsArray()
  parameters!: unknown[];

  @ApiPropertyOptional({ type: SandboxContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SandboxContextDto)
  context?: SandboxContextDto;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Experiment session id for isolated playground scope',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
