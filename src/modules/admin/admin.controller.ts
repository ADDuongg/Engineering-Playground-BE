import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@db-play/types';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { GetAdminMeUseCase } from './application/get-admin-me.usecase';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly getAdminMeUseCase: GetAdminMeUseCase) {}

  @Get('me')
  @ApiOperation({
    summary: 'Admin whoami — confirm identity and admin role',
  })
  async me(@CurrentUser() user: JwtPayload) {
    return this.getAdminMeUseCase.execute(user.sub);
  }
}
