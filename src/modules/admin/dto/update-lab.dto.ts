import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LabStatus } from '@db-play/types';

export class UpdateLabDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  sequenceOrder?: number;

  @IsOptional()
  @IsEnum(LabStatus)
  status?: LabStatus;
}
