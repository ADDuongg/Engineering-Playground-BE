import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LabStatus } from '@db-play/types';

export class CreateLabDto {
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  description?: string | null;

  @IsInt()
  sequenceOrder!: number;

  @IsOptional()
  @IsEnum(LabStatus)
  status?: LabStatus;
}
