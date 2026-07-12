import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListAdminUsersQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive substring match on email or display name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;
}
