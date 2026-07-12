import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AdminTrackSlugParamDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug!: string;
}
