import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
  ValidateIf,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LAB_GUIDED_STEP_ACTIONS } from '@db-play/types';

export class GuidedSqlDto {
  @IsString()
  @MinLength(1)
  sql!: string;

  @IsArray()
  exampleParameters!: unknown[];

  @IsArray()
  @IsString({ each: true })
  paramHints!: string[];

  @IsString()
  description!: string;
}

export class LabSummaryDatasetHintDto {
  @IsString()
  @MinLength(1)
  family!: string;

  @IsString()
  @MinLength(1)
  version!: string;

  @IsArray()
  @IsString({ each: true })
  recommendedTier!: string[];
}

export class CreateLabGuidedStepDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  instruction!: string;

  @IsIn([...LAB_GUIDED_STEP_ACTIONS])
  action!: (typeof LAB_GUIDED_STEP_ACTIONS)[number];

  @IsInt()
  displayOrder!: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  payload?: Record<string, unknown> | null;
}

export class UpdateLabGuidedStepDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  instruction?: string;

  @IsOptional()
  @IsIn([...LAB_GUIDED_STEP_ACTIONS])
  action?: (typeof LAB_GUIDED_STEP_ACTIONS)[number];

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsObject()
  payload?: Record<string, unknown> | null;
}

export class ReorderLabGuidedStepsDto {
  @IsArray()
  @IsString({ each: true })
  stepIds!: string[];
}

export class CreateLabCurriculumDto {
  @IsString()
  @MinLength(1)
  learningGoal!: string;

  @IsString()
  @MinLength(1)
  theory!: string;

  @ValidateNested()
  @Type(() => GuidedSqlDto)
  recommendedQuery!: GuidedSqlDto;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  recommendedCreateIndexSql?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  recommendedDropIndexSql?: string | null;

  @ValidateNested()
  @Type(() => LabSummaryDatasetHintDto)
  dataset!: LabSummaryDatasetHintDto;

  @IsBoolean()
  quizRequired!: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  optionalBenchmarkNote?: string | null;
}

export class UpdateLabCurriculumDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  learningGoal?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  theory?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GuidedSqlDto)
  recommendedQuery?: GuidedSqlDto;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  recommendedCreateIndexSql?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  recommendedDropIndexSql?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => LabSummaryDatasetHintDto)
  dataset?: LabSummaryDatasetHintDto;

  @IsOptional()
  @IsBoolean()
  quizRequired?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  optionalBenchmarkNote?: string | null;
}

export class AdminLabFlowLabSlugParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  labSlug!: string;
}

export class AdminLabFlowStepIdParamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  labSlug!: string;

  @IsString()
  @MinLength(1)
  stepId!: string;
}
