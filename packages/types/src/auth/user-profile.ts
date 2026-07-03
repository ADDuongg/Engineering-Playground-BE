import { Role } from '../enums/role.enum';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}
