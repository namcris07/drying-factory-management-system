import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CurrentActor } from '../common/rbac/current-actor.decorator';
import type { ActorContext } from '../common/rbac/permissions';

@Controller('organizations')
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get()
  findAll(@CurrentActor() actor?: ActorContext) {
    return this.organizationsService.findAll(actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.organizationsService.findOne(id, actor);
  }

  @Post()
  create(
    @Body() dto: CreateOrganizationDto,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.organizationsService.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateOrganizationDto>,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.organizationsService.update(id, dto, actor);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.organizationsService.remove(id, actor);
  }
}
