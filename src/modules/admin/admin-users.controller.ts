import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@db-play/types';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { AdminUserIdParamDto } from './dto/admin-user-id.param.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users.query.dto';
import { UpdateAdminUserRoleDto } from './dto/update-admin-user-role.dto';
import { ListAdminUsersUseCase } from './application/list-admin-users.usecase';
import { GetAdminUserUseCase } from './application/get-admin-user.usecase';
import { UpdateAdminUserRoleUseCase } from './application/update-admin-user-role.usecase';

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly listAdminUsersUseCase: ListAdminUsersUseCase,
    private readonly getAdminUserUseCase: GetAdminUserUseCase,
    private readonly updateAdminUserRoleUseCase: UpdateAdminUserRoleUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List/search users (paginated; no credential secrets)',
  })
  async list(@Query() query: ListAdminUsersQueryDto) {
    return this.listAdminUsersUseCase.execute({
      page: query.page,
      limit: query.limit,
      q: query.q,
    });
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by id (admin directory)' })
  async get(@Param() params: AdminUserIdParamDto) {
    return this.getAdminUserUseCase.execute(params.userId);
  }

  @Patch(':userId')
  @ApiOperation({
    summary:
      'Update user role (user ↔ admin); last-admin demotion rejected; no forced logout',
  })
  async updateRole(
    @Param() params: AdminUserIdParamDto,
    @Body() body: UpdateAdminUserRoleDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.updateAdminUserRoleUseCase.execute(
      params.userId,
      body.role,
      actor.sub,
    );
  }
}
