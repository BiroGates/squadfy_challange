import { SetMetadata } from '@nestjs/common';
import { Roles } from 'src/types/auth/enum';

export const ROLES_KEY = 'roles';
export const RolesDecoretor = (...roles: Roles[]) => SetMetadata(ROLES_KEY, roles);
