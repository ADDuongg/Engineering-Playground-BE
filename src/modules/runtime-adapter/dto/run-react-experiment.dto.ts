import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class ReactExperimentOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  memo?: boolean;

  @ApiPropertyOptional({ enum: ['index', 'stable'] })
  @IsOptional()
  @IsIn(['index', 'stable'])
  keyStrategy?: 'index' | 'stable';
}

export class RunReactExperimentDto {
  @ApiProperty({ example: 'update_state' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  action!: string;

  @ApiProperty({ example: 'rendering/counter' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  fixtureId!: string;

  @ApiProperty({ example: 'react-rendering' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  labSlug!: string;

  @ApiPropertyOptional({ example: 'frontend-react' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  trackSlug?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  interactions?: unknown[];

  @ApiPropertyOptional({ type: ReactExperimentOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReactExperimentOptionsDto)
  options?: ReactExperimentOptionsDto;

  /** Forbidden in MVP — present only so forbidNonWhitelisted can reject callers. */
  @ApiPropertyOptional({
    description: 'Not supported in MVP; requests including this field are rejected.',
  })
  @IsOptional()
  @IsString()
  componentSource?: string;
}
