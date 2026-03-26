import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto, UpdateBatchDto } from './dto/create-batch.dto';
import { MqttService } from '../mqtt/mqtt.service';

type RecipeStageItem = {
  stageID: number;
  stageOrder: number;
  durationMinutes: number;
  temperatureSetpoint: number;
  humiditySetpoint: number;
};

type StageProgress = {
  activeStage: RecipeStageItem | null;
  activeStageStartedAt: Date;
  remainingToNextMs: number;
  isFinished: boolean;
};

@Injectable()
export class BatchesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BatchesService.name);
  private readonly stageTimers = new Map<number, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private mqttService: MqttService,
  ) {}

  async onModuleInit() {
    await this.recoverRunningBatches();
  }

  onModuleDestroy() {
    for (const timer of this.stageTimers.values()) {
      clearTimeout(timer);
    }
    this.stageTimers.clear();
  }

  findAll() {
    return this.prisma.batch.findMany({
      include: {
        recipe: { select: { recipeID: true, recipeName: true } },
        device: { select: { deviceID: true, deviceName: true } },
        batchOperations: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
      orderBy: { batchesID: 'desc' },
    });
  }

  async findOne(id: number) {
    const batch = await this.prisma.batch.findUnique({
      where: { batchesID: id },
      include: {
        recipe: {
          include: {
            steps: { orderBy: { stepNo: 'asc' } },
            stages: { orderBy: { stageOrder: 'asc' } },
          },
        },
        device: true,
        batchOperations: { orderBy: { startedAt: 'asc' } },
        alerts: { orderBy: { alertTime: 'desc' } },
      },
    });
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  async create(dto: CreateBatchDto) {
    const startAt = new Date(dto.startTime);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('startTime không hợp lệ.');
    }

    const recipe = await this.prisma.recipe.findUnique({
      where: { recipeID: dto.recipeID },
      include: {
        stages: { orderBy: { stageOrder: 'asc' } },
      },
    });

    if (!recipe) {
      throw new BadRequestException(`Recipe ${dto.recipeID} không tồn tại.`);
    }

    if (recipe.stages.length === 0) {
      throw new BadRequestException(
        `Recipe ${dto.recipeID} chưa có RecipeStage.`,
      );
    }

    const created = await this.prisma.batch.create({
      data: {
        batchStatus: dto.batchStatus ?? 'Running',
        operationMode: dto.operationMode ?? 'auto',
        recipeID: dto.recipeID,
        deviceID: dto.deviceID,
        startedAt: startAt,
        stageStartedAt: startAt,
        currentStage: recipe.stages[0].stageOrder,
      },
      include: {
        recipe: { select: { recipeID: true, recipeName: true } },
        device: { select: { deviceID: true, deviceName: true } },
      },
    });

    await this.prisma.batchOperation.create({
      data: {
        batchesID: created.batchesID,
        startedAt: startAt,
      },
    });

    await this.synchronizeBatchProgress(created.batchesID);

    return this.findOne(created.batchesID);
  }

  async update(id: number, dto: UpdateBatchDto) {
    await this.findOne(id);
    const updated = await this.prisma.batch.update({
      where: { batchesID: id },
      data: dto,
      include: {
        recipe: { select: { recipeID: true, recipeName: true } },
        device: { select: { deviceID: true, deviceName: true } },
      },
    });

    if (updated.batchStatus !== 'Running') {
      this.clearStageTimer(id);
    } else {
      await this.synchronizeBatchProgress(id);
    }

    return updated;
  }

  async remove(id: number) {
    this.clearStageTimer(id);
    await this.findOne(id);
    return this.prisma.batch.delete({ where: { batchesID: id } });
  }

  private async recoverRunningBatches() {
    const runningBatches = await this.prisma.batch.findMany({
      where: {
        batchStatus: {
          in: ['Running', 'InProgress', 'Active', 'Processing'],
        },
      },
      select: { batchesID: true },
    });

    await Promise.all(
      runningBatches.map((batch) =>
        this.synchronizeBatchProgress(batch.batchesID),
      ),
    );
  }

  private async synchronizeBatchProgress(batchId: number) {
    const batch = await this.prisma.batch.findUnique({
      where: { batchesID: batchId },
      include: {
        recipe: {
          select: {
            recipeID: true,
            recipeName: true,
            stages: {
              orderBy: { stageOrder: 'asc' },
              select: {
                stageID: true,
                stageOrder: true,
                durationMinutes: true,
                temperatureSetpoint: true,
                humiditySetpoint: true,
              },
            },
          },
        },
        device: {
          select: {
            deviceID: true,
            deviceName: true,
          },
        },
      },
    });

    if (!batch) {
      this.clearStageTimer(batchId);
      return;
    }

    if (!batch.startedAt) {
      this.logger.warn(`Batch ${batchId} thiếu StartedAt, bỏ qua scheduler.`);
      return;
    }

    if (!batch.recipe || batch.recipe.stages.length === 0) {
      this.logger.warn(`Batch ${batchId} thiếu RecipeStage, bỏ qua scheduler.`);
      return;
    }

    if (batch.batchStatus !== 'Running') {
      this.clearStageTimer(batchId);
      return;
    }

    const progress = this.resolveCurrentStageProgress(
      batch.recipe.stages,
      batch.startedAt,
      new Date(),
    );

    if (progress.isFinished) {
      await this.completeBatch(batchId);
      return;
    }

    if (!progress.activeStage) return;

    await this.prisma.batch.update({
      where: { batchesID: batchId },
      data: {
        currentStage: progress.activeStage.stageOrder,
        stageStartedAt: progress.activeStageStartedAt,
      },
    });

    await this.publishStageSetpoints({
      batchId,
      stage: progress.activeStage,
      recipeName: batch.recipe.recipeName,
      deviceId: batch.device?.deviceID ?? batch.deviceID,
      deviceName: batch.device?.deviceName ?? null,
    });

    this.scheduleNextStage(batchId, progress.remainingToNextMs);
  }

  private resolveCurrentStageProgress(
    stages: RecipeStageItem[],
    batchStartTime: Date,
    now: Date,
  ): StageProgress {
    const elapsedMs = Math.max(0, now.getTime() - batchStartTime.getTime());
    let totalMs = 0;

    for (const stage of stages) {
      const durationMs = Math.max(1, stage.durationMinutes) * 60_000;
      const nextTotal = totalMs + durationMs;

      if (elapsedMs < nextTotal) {
        return {
          activeStage: stage,
          activeStageStartedAt: new Date(batchStartTime.getTime() + totalMs),
          remainingToNextMs: Math.max(1_000, nextTotal - elapsedMs),
          isFinished: false,
        };
      }

      totalMs = nextTotal;
    }

    return {
      activeStage: null,
      activeStageStartedAt: new Date(batchStartTime.getTime() + totalMs),
      remainingToNextMs: 0,
      isFinished: true,
    };
  }

  private scheduleNextStage(batchId: number, delayMs: number) {
    this.clearStageTimer(batchId);
    const timer = setTimeout(
      () => {
        void this.synchronizeBatchProgress(batchId);
      },
      Math.max(1_000, delayMs),
    );
    this.stageTimers.set(batchId, timer);
  }

  private clearStageTimer(batchId: number) {
    const timer = this.stageTimers.get(batchId);
    if (!timer) return;
    clearTimeout(timer);
    this.stageTimers.delete(batchId);
  }

  private async completeBatch(batchId: number) {
    this.clearStageTimer(batchId);

    await this.prisma.$transaction([
      this.prisma.batch.update({
        where: { batchesID: batchId },
        data: {
          batchStatus: 'Completed',
          batchResult: 'CompletedBySchedule',
        },
      }),
      this.prisma.batchOperation.updateMany({
        where: {
          batchesID: batchId,
          endedAt: null,
        },
        data: { endedAt: new Date() },
      }),
    ]);
  }

  private async publishStageSetpoints(params: {
    batchId: number;
    stage: RecipeStageItem;
    recipeName: string | null;
    deviceId: number | null;
    deviceName: string | null;
  }) {
    const tempFeed = await this.getConfigOrDefault(
      'temperatureSetpointFeed',
      'temperature_setpoint',
    );
    const humFeed = await this.getConfigOrDefault(
      'humiditySetpointFeed',
      'humidity_setpoint',
    );

    try {
      const [tempResult, humResult] = await Promise.all([
        this.mqttService.publishCommand(
          tempFeed,
          params.stage.temperatureSetpoint,
          true,
        ),
        this.mqttService.publishCommand(
          humFeed,
          params.stage.humiditySetpoint,
          true,
        ),
      ]);

      if (!tempResult.ok || !humResult.ok) {
        const note = [tempResult.note, humResult.note]
          .filter(Boolean)
          .join(' | ');
        throw new Error(note || 'MQTT publish command thất bại.');
      }
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Lỗi không xác định khi publish MQTT.';
      this.logger.error(
        `Batch ${params.batchId} stage ${params.stage.stageOrder}: chuyển giai đoạn thất bại do MQTT (${msg}).`,
      );

      await this.prisma.alert.create({
        data: {
          alertType: 'error',
          alertStatus: 'pending',
          alertTime: new Date(),
          deviceID: params.deviceId,
          batchesID: params.batchId,
          alertMessage: `${params.deviceName || 'Thiết bị'}: Không gửi được setpoint MQTT khi chuyển sang giai đoạn ${params.stage.stageOrder} (${params.recipeName || 'Recipe'}).`,
        },
      });
    }
  }

  private async getConfigOrDefault(key: string, fallback: string) {
    const row = await this.prisma.systemConfig.findUnique({
      where: { configKey: key },
      select: { configValue: true },
    });
    const value = row?.configValue?.trim();
    return value || fallback;
  }
}
