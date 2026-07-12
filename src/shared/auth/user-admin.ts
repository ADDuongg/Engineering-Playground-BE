import { Role } from '../enums/role.enum';

export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAdminUserRoleRequest {
  role: Role.USER | Role.ADMIN;
}

export interface AdminUserListQuery {
  page?: number;
  limit?: number;
  q?: string;
}

export interface AdminUserPaginationMeta {
  page: number;
  limit: number;
  total: number;
}
