import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class QuizLabSlugParamDto {
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'labSlug must contain only lowercase letters, numbers, and hyphens',
  })
  labSlug!: string;
}
