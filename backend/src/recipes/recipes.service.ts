import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  private readonly recipeInclude: Prisma.RecipeInclude = {
    steps: { orderBy: { stepNo: 'asc' as const } },
    stages: { orderBy: { stageOrder: 'asc' as const } },
    _count: { select: { batches: true } } as never,
  };

  private toRecipeResponse(recipe: Record<string, unknown>) {
    const { _count, ...rest } = recipe as Record<string, unknown> & {
      _count?: { batches?: number };
    };
    return {
      ...rest,
      batchCount: _count?.batches ?? 0,
    };
  }

  private normalizeStageInput(
    stage: {
      stageOrder?: number;
      durationMinutes?: number;
      temperatureSetpoint?: number;
      humiditySetpoint?: number;
      temperatureGoal?: number;
      humidityGoal?: number;
    },
    index: number,
  ) {
    const stageOrder = Number(stage.stageOrder ?? index + 1);
    const durationMinutes = Number(stage.durationMinutes);
    const temperatureSetpoint = Number(
      stage.temperatureSetpoint ?? stage.temperatureGoal,
    );
    const humiditySetpoint = Number(
      stage.humiditySetpoint ?? stage.humidityGoal,
    );

    if (
      !Number.isFinite(stageOrder) ||
      !Number.isFinite(durationMinutes) ||
      !Number.isFinite(temperatureSetpoint) ||
      !Number.isFinite(humiditySetpoint)
    ) {
      throw new BadRequestException(
        `stages[${index}] must include numeric stageOrder, durationMinutes, temperatureSetpoint, humiditySetpoint`,
      );
    }

    return {
      stageOrder,
      durationMinutes,
      temperatureSetpoint,
      humiditySetpoint,
    };
  }

  async findAll(includeInactive = false) {
    const rows = await this.prisma.recipe.findMany({
      where: includeInactive ? undefined : ({ isActive: true } as never),
      include: this.recipeInclude,
      orderBy: { recipeID: 'asc' },
    });

    return rows.map((row) =>
      this.toRecipeResponse(row as Record<string, unknown>),
    );
  }

  async findOne(id: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID: id },
      include: this.recipeInclude,
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);
    return this.toRecipeResponse(recipe as Record<string, unknown>);
  }

  async create(dto: CreateRecipeDto) {
    const { steps, stages, ...recipeData } = dto;

    const normalizedStages = (stages ?? []).map((stage, i) =>
      this.normalizeStageInput(stage, i),
    );

    const derivedStages =
      normalizedStages.length > 0
        ? normalizedStages
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

    const created = await this.prisma.recipe.create({
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
      include: this.recipeInclude,
    });

    return this.toRecipeResponse(created as Record<string, unknown>);
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
    if (recipeData.isActive !== undefined)
      (data as Record<string, unknown>).isActive = recipeData.isActive;

    void steps;

    if (stages && stages.length > 0) {
      await this.prisma.recipeStage.deleteMany({ where: { recipeID: id } });

      await this.prisma.recipeStage.createMany({
        data: stages.map((stage, i) => ({
          ...this.normalizeStageInput(stage, i),
          recipeID: id,
        })),
      });
    }

    const updated = await this.prisma.recipe.update({
      where: { recipeID: id },
      data,
      include: this.recipeInclude,
    });

    return this.toRecipeResponse(updated as Record<string, unknown>);
  }

  async remove(id: number) {
    await this.findOne(id);

    const usedByBatchCount = await this.prisma.batch.count({
      where: { recipeID: id },
    });

    if (usedByBatchCount > 0) {
      const hidden = await this.prisma.recipe.update({
        where: { recipeID: id },
        data: { isActive: false } as never,
        include: this.recipeInclude,
      });

      return {
        action: 'hidden' as const,
        recipe: this.toRecipeResponse(hidden as Record<string, unknown>),
      };
    }

    await this.prisma.recipeStage.deleteMany({ where: { recipeID: id } });
    await this.prisma.recipeStep.deleteMany({ where: { recipeID: id } });
    await this.prisma.recipe.delete({ where: { recipeID: id } });

    return {
      action: 'deleted' as const,
      recipeID: id,
    };
  }
}
