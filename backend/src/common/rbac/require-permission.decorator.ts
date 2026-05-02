import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions';

export const RBAC_PERMISSIONS_KEY = 'rbac.permissions';

export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(RBAC_PERMISSIONS_KEY, permissions);
