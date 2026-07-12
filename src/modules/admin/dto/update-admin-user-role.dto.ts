import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@db-play/types';

export class UpdateAdminUserRoleDto {
  @ApiProperty({ enum: [Role.USER, Role.ADMIN] })
  @IsEnum(Role, { message: 'role must be user or admin' })
  role!: Role;
}
