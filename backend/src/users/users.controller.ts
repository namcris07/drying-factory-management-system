import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { RbacPermissionGuard } from '../common/rbac/rbac-permission.guard';
import { CurrentActor } from '../common/rbac/current-actor.decorator';
import type { ActorContext } from '../common/rbac/permissions';

@Controller('users')
@UseGuards(RbacPermissionGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @RequirePermission('users.read')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermission('users.read')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermission('users.create')
  create(@Body() dto: CreateUserDto, @CurrentActor() actor?: ActorContext) {
    return this.usersService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermission('users.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermission('users.delete')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.usersService.remove(id, actor);
  }
}
