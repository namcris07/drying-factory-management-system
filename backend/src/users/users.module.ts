import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RbacPermissionGuard } from '../common/rbac/rbac-permission.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, RbacPermissionGuard],
})
export class UsersModule {}
