import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminUserIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  userId!: string;
}
