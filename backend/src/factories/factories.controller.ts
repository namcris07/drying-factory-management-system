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
import { FactoriesService } from './factories.service';
import { CreateFactoryDto } from './dto/create-factory.dto';
import { CurrentActor } from '../common/rbac/current-actor.decorator';
import type { ActorContext } from '../common/rbac/permissions';

@Controller('factories')
export class FactoriesController {
  constructor(private factoriesService: FactoriesService) {}

  @Get()
  findAll(@CurrentActor() actor?: ActorContext) {
    return this.factoriesService.findAll(actor);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.factoriesService.findOne(id, actor);
  }

  @Post()
  create(@Body() dto: CreateFactoryDto, @CurrentActor() actor?: ActorContext) {
    return this.factoriesService.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateFactoryDto>,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.factoriesService.update(id, dto, actor);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.factoriesService.remove(id, actor);
  }
}
