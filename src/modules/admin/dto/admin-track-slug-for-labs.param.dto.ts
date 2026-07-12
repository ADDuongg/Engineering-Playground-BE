import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AdminTrackSlugForLabsParamDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'trackSlug must contain only lowercase letters, numbers, and hyphens',
  })
  trackSlug!: string;
}
