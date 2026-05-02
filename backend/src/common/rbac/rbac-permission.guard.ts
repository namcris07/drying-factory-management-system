import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ActorContext,
  Permission,
  hasPermission,
  isActorRole,
} from './permissions';
import { RBAC_PERMISSIONS_KEY } from './require-permission.decorator';

type RequestWithActor = {
  headers?: Record<string, string | string[] | undefined>;
  actor?: ActorContext;
};

@Injectable()
export class RbacPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      RBAC_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const roleHeader = request.headers?.['x-user-role'];
    const userIdHeader = request.headers?.['x-user-id'];

    const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
    const userIdRaw = Array.isArray(userIdHeader)
      ? userIdHeader[0]
      : userIdHeader;

    if (!isActorRole(role)) {
      throw new UnauthorizedException('Thiếu vai trò truy cập hợp lệ.');
    }

    const userID = Number(userIdRaw);
    if (!Number.isInteger(userID) || userID <= 0) {
      throw new UnauthorizedException('Thiếu định danh người dùng hợp lệ.');
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      hasPermission(role, permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này.',
      );
    }

    request.actor = { userID, role };
    return true;
  }
}
