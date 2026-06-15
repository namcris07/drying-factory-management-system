import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { CurrentActor } from '../common/rbac/current-actor.decorator';
import type { ActorContext } from '../common/rbac/permissions';

@Controller('recipes')
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  @Get()
  findAll(
    @Query('includeInactive') includeInactive?: string,
    @Query('status') status?: 'all' | 'active' | 'inactive',
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentActor() actor?: ActorContext,
  ) {
    const showInactive = ['1', 'true', 'yes'].includes(
      (includeInactive ?? '').toLowerCase(),
    );

    return this.recipesService.findAll(
      {
        includeInactive: showInactive,
        status,
        search,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      actor,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.recipesService.findOne(id, actor);
  }

  @Post()
  create(@Body() dto: CreateRecipeDto, @CurrentActor() actor?: ActorContext) {
    return this.recipesService.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateRecipeDto>,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.recipesService.update(id, dto, actor);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.recipesService.remove(id, actor);
  }
}
