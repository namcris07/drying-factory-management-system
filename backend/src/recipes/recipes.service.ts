import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.recipe.findMany({
      include: { steps: { orderBy: { stepNo: 'asc' } } },
      orderBy: { recipeID: 'asc' },
    });
  }

  async findOne(id: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID: id },
      include: { steps: { orderBy: { stepNo: 'asc' } } },
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    return recipe;
  }

  async create(dto: CreateRecipeDto) {
    const { steps, ...recipeData } = dto;
    return this.prisma.recipe.create({
      data: {
        ...recipeData,
        steps: steps
          ? { create: steps.map((s, i) => ({ ...s, stepNo: s.stepNo ?? i + 1 })) }
          : undefined,
      },
      include: { steps: { orderBy: { stepNo: 'asc' } } },
    });
  }

  async update(id: number, dto: Partial<CreateRecipeDto>) {
    await this.findOne(id);
    const { steps, ...recipeData } = dto;
    return this.prisma.recipe.update({
      where: { recipeID: id },
      data: recipeData,
      include: { steps: { orderBy: { stepNo: 'asc' } } },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.recipeStep.deleteMany({ where: { recipeID: id } });
    return this.prisma.recipe.delete({ where: { recipeID: id } });
  }
}
