import { IsArray, IsUUID, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
class SubmitQuizAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsUUID()
  optionId!: string;
}

export class SubmitQuizDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitQuizAnswerDto)
  answers!: SubmitQuizAnswerDto[];
}
