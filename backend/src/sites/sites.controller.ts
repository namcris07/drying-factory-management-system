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
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { CurrentActor } from '../common/rbac/current-actor.decorator';
import type { ActorContext } from '../common/rbac/permissions';

@Controller('sites')
export class SitesController {
  constructor(private sitesService: SitesService) {}

  @Get()
  findAll(@CurrentActor() actor?: ActorContext) {
    return this.sitesService.findAll(actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.sitesService.findOne(id, actor);
  }

  @Post()
  create(@Body() dto: CreateSiteDto, @CurrentActor() actor?: ActorContext) {
    return this.sitesService.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateSiteDto>,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.sitesService.update(id, dto, actor);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.sitesService.remove(id, actor);
  }
}
