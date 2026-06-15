import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import type { ActorContext } from '../common/rbac/permissions';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  private async getUserScope(actor?: ActorContext) {
    if (!actor || actor.role === 'Admin') return null;
    const user = await this.prisma.user.findUnique({
      where: { userID: actor.userID },
      select: { organizationID: true, factoryID: true, siteID: true },
    });
    if (!user) throw new ForbiddenException('User scope not found.');
    return user;
  }

  private buildRecipeWhere(params: {
    includeInactive?: boolean;
    status?: 'all' | 'active' | 'inactive';
    search?: string;
  }): Prisma.RecipeWhereInput {
    const status = params.status ?? (params.includeInactive ? 'all' : 'active');
    const search = params.search?.trim();

    const where: Prisma.RecipeWhereInput = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { recipeName: { contains: search, mode: 'insensitive' } },
        { recipeFruits: { contains: search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async syncRecipeIdSequence() {
    await this.prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"Recipes"', 'RecipeID'),
        COALESCE((SELECT MAX("RecipeID") FROM "Recipes"), 0) + 1,
        false
      );
    `);
  }

  private isRecipePrimaryKeyConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const maybeError = error as {
      code?: string;
      meta?: {
        target?: unknown;
        driverAdapterError?: {
          cause?: { constraint?: { fields?: string[] } };
        };
      };
    };

    if (maybeError.code !== 'P2002') return false;

    const target = maybeError.meta?.target;
    if (
      Array.isArray(target) &&
      target.some((t) => String(t).includes('RecipeID'))
    ) {
      return true;
    }

    const fields =
      maybeError.meta?.driverAdapterError?.cause?.constraint?.fields ?? [];
    return fields.some((field) => String(field).includes('RecipeID'));
  }

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
      stageOrder <= 0 ||
      durationMinutes <= 0 ||
      !Number.isFinite(temperatureSetpoint) ||
      !Number.isFinite(humiditySetpoint)
    ) {
      throw new BadRequestException(
        `stages[${index}] must include positive stageOrder, positive durationMinutes, numeric temperatureSetpoint, humiditySetpoint`,
      );
    }

    return {
      stageOrder,
      durationMinutes,
      temperatureSetpoint,
      humiditySetpoint,
    };
  }

  private sumStageDurationMinutes(
    stages: Array<{
      durationMinutes: number;
    }>,
  ) {
    const total = stages.reduce(
      (sum, stage) => sum + Number(stage.durationMinutes || 0),
      0,
    );
    return Math.max(1, Math.round(total || 0));
  }

  async findAll(
    params: {
      includeInactive?: boolean;
      status?: 'all' | 'active' | 'inactive';
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
    actor?: ActorContext,
  ) {
    const scope = await this.getUserScope(actor);
    const where = this.buildRecipeWhere(params);
    if (scope) {
      where.factoryID = scope.factoryID ?? -1;
    }
    const page =
      params.page !== undefined ? Math.max(1, Number(params.page)) : undefined;
    const pageSize =
      params.pageSize !== undefined
        ? Math.min(100, Math.max(1, Number(params.pageSize)))
        : undefined;

    if (page && pageSize) {
      const skip = (page - 1) * pageSize;

      const [items, total] = await this.prisma.$transaction([
        this.prisma.recipe.findMany({
          where,
          include: this.recipeInclude,
          orderBy: { recipeID: 'asc' },
          skip,
          take: pageSize,
        }),
        this.prisma.recipe.count({ where }),
      ]);

      return {
        items: items.map((row) =>
          this.toRecipeResponse(row as Record<string, unknown>),
        ),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
    }

    const rows = await this.prisma.recipe.findMany({
      where,
      include: this.recipeInclude,
      orderBy: { recipeID: 'asc' },
    });

    return rows.map((row) =>
      this.toRecipeResponse(row as Record<string, unknown>),
    );
  }

  async findOne(id: number, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID: id },
      include: this.recipeInclude,
    });
    if (!recipe) throw new NotFoundException(`Recipe ${id} not found`);

    if (scope && recipe.factoryID !== scope.factoryID) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập công thức này.',
      );
    }

    return this.toRecipeResponse(recipe as Record<string, unknown>);
  }

  async create(dto: CreateRecipeDto, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const { steps, stages, ...recipeData } = dto;

    if (scope) {
      recipeData.organizationID = scope.organizationID ?? undefined;
      recipeData.factoryID = scope.factoryID ?? undefined;
      recipeData.userID = actor?.userID;
    }

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
    const resolvedDuration =
      derivedStages.length > 0
        ? this.sumStageDurationMinutes(derivedStages)
        : recipeData.timeDurationEst;

    const payload = {
      data: {
        ...recipeData,
        timeDurationEst: resolvedDuration,
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
    } as const;

    let created;
    try {
      created = await this.prisma.recipe.create(payload);
    } catch (error) {
      if (!this.isRecipePrimaryKeyConflict(error)) {
        throw error;
      }

      await this.syncRecipeIdSequence();
      created = await this.prisma.recipe.create(payload);
    }

    return this.toRecipeResponse(created as Record<string, unknown>);
  }

  async update(
    id: number,
    dto: Partial<CreateRecipeDto>,
    actor?: ActorContext,
  ) {
    await this.findOne(id, actor);
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
      const normalizedStages = stages.map((stage, i) =>
        this.normalizeStageInput(stage, i),
      );

      await this.prisma.recipeStage.deleteMany({ where: { recipeID: id } });

      await this.prisma.recipeStage.createMany({
        data: normalizedStages.map((stage) => ({
          ...stage,
          recipeID: id,
        })),
      });

      data.timeDurationEst = this.sumStageDurationMinutes(normalizedStages);
    }

    const updated = await this.prisma.recipe.update({
      where: { recipeID: id },
      data,
      include: this.recipeInclude,
    });

    return this.toRecipeResponse(updated as Record<string, unknown>);
  }

  async remove(id: number, actor?: ActorContext) {
    await this.findOne(id, actor);

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
