import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdminQuizLabSlugParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  labSlug!: string;
}

export class AdminQuizQuestionIdParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  labSlug!: string;

  @IsUUID()
  questionId!: string;
}

export class AdminQuizOptionIdParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  labSlug!: string;

  @IsUUID()
  questionId!: string;

  @IsUUID()
  optionId!: string;
}

export class CreateLabQuizDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  title?: string | null;
}

export class UpdateLabQuizDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  title?: string | null;
}

export class CreateQuizOptionInlineDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsInt()
  sequenceOrder!: number;

  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateQuizQuestionDto {
  @IsString()
  @MinLength(1)
  prompt!: string;

  @IsInt()
  sequenceOrder!: number;

  @IsOptional()
  @IsIn(['single_select'])
  questionType?: 'single_select';

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateQuizOptionInlineDto)
  options!: CreateQuizOptionInlineDto[];
}

export class UpdateQuizQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  prompt?: string;

  @IsOptional()
  @IsInt()
  sequenceOrder?: number;
}

export class CreateQuizOptionDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsInt()
  sequenceOrder!: number;

  @IsBoolean()
  isCorrect!: boolean;
}

export class UpdateQuizOptionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsInt()
  sequenceOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCorrect?: boolean;
}

export class ReorderQuizQuestionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  questionIds!: string[];
}

export class ReorderQuizOptionsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  optionIds!: string[];
}
