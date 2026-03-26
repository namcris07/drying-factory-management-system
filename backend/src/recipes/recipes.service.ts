import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.recipe.findMany({
      include: {
        steps: { orderBy: { stepNo: 'asc' } },
        stages: { orderBy: { stageOrder: 'asc' } },
      },
      orderBy: { recipeID: 'asc' },
    });
  }

  async findOne(id: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID: id },
      include: {
        steps: { orderBy: { stepNo: 'asc' } },
        stages: { orderBy: { stageOrder: 'asc' } },
      },
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    return recipe;
  }

  async create(dto: CreateRecipeDto) {
    const { steps, stages, ...recipeData } = dto;

    const derivedStages =
      stages && stages.length > 0
        ? stages
        : (steps ?? [])
            .filter((s) => Number(s.durationMinutes) > 0)
            .map((s, i) => ({
              stageOrder: Number(s.stepNo ?? i + 1),
              durationMinutes: Number(s.durationMinutes),
              temperatureSetpoint: Number(s.temperatureGoal ?? 0),
              humiditySetpoint: Number(s.humidityGoal ?? 0),
            }))
            .filter(
              (s) =>
                Number.isFinite(s.temperatureSetpoint) &&
                Number.isFinite(s.humiditySetpoint),
            );

    return this.prisma.recipe.create({
      data: {
        ...recipeData,
        steps: steps
          ? {
              create: steps.map((s, i) => ({
                ...s,
                stepNo: s.stepNo ?? i + 1,
              })),
            }
          : undefined,
        stages:
          derivedStages.length > 0
            ? {
                create: derivedStages.map((stage) => ({
                  stageOrder: stage.stageOrder,
                  durationMinutes: stage.durationMinutes,
                  temperatureSetpoint: stage.temperatureSetpoint,
                  humiditySetpoint: stage.humiditySetpoint,
                })),
              }
            : undefined,
      },
      include: {
        steps: { orderBy: { stepNo: 'asc' } },
        stages: { orderBy: { stageOrder: 'asc' } },
      },
    });
  }

  async update(id: number, dto: Partial<CreateRecipeDto>) {
    await this.findOne(id);
    const { steps, stages, ...recipeData } = dto;
    const data: Prisma.RecipeUncheckedUpdateInput = {};

    if (recipeData.recipeName !== undefined)
      data.recipeName = recipeData.recipeName;
    if (recipeData.recipeFruits !== undefined)
      data.recipeFruits = recipeData.recipeFruits;
    if (recipeData.timeDurationEst !== undefined)
      data.timeDurationEst = recipeData.timeDurationEst;
    if (recipeData.userID !== undefined) data.userID = recipeData.userID;

    void steps;

    if (stages && stages.length > 0) {
      await this.prisma.recipeStage.deleteMany({ where: { recipeID: id } });

      await this.prisma.recipeStage.createMany({
        data: stages.map((stage, i) => ({
          recipeID: id,
          stageOrder: Number(stage.stageOrder ?? i + 1),
          durationMinutes: Number(stage.durationMinutes),
          temperatureSetpoint: Number(stage.temperatureSetpoint),
          humiditySetpoint: Number(stage.humiditySetpoint),
        })),
      });
    }

    return this.prisma.recipe.update({
      where: { recipeID: id },
      data,
      include: {
        steps: { orderBy: { stepNo: 'asc' } },
        stages: { orderBy: { stageOrder: 'asc' } },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.recipeStage.deleteMany({ where: { recipeID: id } });
    await this.prisma.recipeStep.deleteMany({ where: { recipeID: id } });
    return this.prisma.recipe.delete({ where: { recipeID: id } });
  }
}
