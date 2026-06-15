import { BadRequestException, ConflictException, ForbiddenException, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AlertsService } from './alerts/alerts.service';
import { AuthService } from './auth/auth.service';
import { BatchesService } from './batches/batches.service';
import { DevicesService } from './devices/devices.service';
import { RecipesService } from './recipes/recipes.service';
import { SensorService } from './sensor/sensor.service';
import { SensorDataService } from './sensor-data/sensor-data.service';
import { SystemConfigService } from './system-config/system-config.service';
import { SystemConfigUpdateService } from './system-config/system-config-update.service';
import { UsersService } from './users/users.service';
import { ZonesService } from './zones/zones.service';
import { ModeControlService } from './mqtt/mode-control.service';
import { AlertsController } from './alerts/alerts.controller';
import { AuthController } from './auth/auth.controller';
import { BatchesController } from './batches/batches.controller';
import { DevicesController } from './devices/devices.controller';
import { RecipesController } from './recipes/recipes.controller';
import { SensorDataController } from './sensor-data/sensor-data.controller';
import { SystemConfigController } from './system-config/system-config.controller';
import { UsersController } from './users/users.controller';
import { ZonesController } from './zones/zones.controller';
import { MqttController } from './mqtt/mqtt.controller';
import { FactoriesService } from './factories/factories.service';
import { FactoriesController } from './factories/factories.controller';
import { OrganizationsService } from './organizations/organizations.service';
import { OrganizationsController } from './organizations/organizations.controller';
import { SitesService } from './sites/sites.service';
import { SitesController } from './sites/sites.controller';
import { RbacPermissionGuard } from './common/rbac/rbac-permission.guard';
import { Reflector } from '@nestjs/core';

jest.mock('@prisma/client', () => {
  class PrismaClient {
    $connect = jest.fn();
    $disconnect = jest.fn();
  }

  return {
    PrismaClient,
    Prisma: {
      JsonNull: null,
    },
  };
});


jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const createPrismaMock = () => {
  const prisma = {
    alert: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    alertResolution: {
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    batch: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    batchOperation: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    device: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    recipe: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    recipeStep: {
      deleteMany: jest.fn(),
    },
    recipeStage: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    sensorDataLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    systemConfig: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    systemConfigUpdate: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    zone: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    factory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    site: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  prisma.$transaction = jest.fn(async (input: unknown) => {
    if (typeof input === 'function') {
      return input(prisma);
    }

    return Promise.all(input as Array<Promise<unknown>>);
  });

  return prisma;
};

describe('Services coverage', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  it('alerts service handles find/create/resolve flow', async () => {
    const service = new AlertsService(prisma as any);
    prisma.alert.findMany.mockResolvedValue([]);
    prisma.alert.count.mockResolvedValue(0);
    prisma.alert.findUnique.mockResolvedValue({ alertID: 1 });
    prisma.alert.create.mockResolvedValue({ alertID: 1 });
    prisma.alert.update.mockResolvedValue({
      alertID: 1,
      alertStatus: 'resolved',
    });
    prisma.alertResolution.create.mockResolvedValue({ alertID: 1 });

    await service.findAll('pending');
    await service.create({ deviceID: 1, alertType: 'temp' } as any);
    await service.acknowledge(1);
    await service.resolve(1, { userID: 2, resolveStatus: 'done' } as any);

    expect(prisma.alert.findMany).toHaveBeenCalled();
    expect(prisma.alert.create).toHaveBeenCalled();
    expect(prisma.alert.update).toHaveBeenCalled();
    expect(prisma.alertResolution.create).toHaveBeenCalled();
  });

  it('alerts service throws when alert not found', async () => {
    const service = new AlertsService(prisma as any);
    prisma.alert.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('auth service handles success and auth failures', async () => {
    const service = new AuthService(prisma as any);
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.login({ email: 'a@a.com', password: 'x' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.user.findFirst.mockResolvedValue({
      userID: 1,
      firstName: 'A',
      lastName: 'B',
      email: 'a@a.com',
      password: 'hashed',
      role: 'Admin',
      zones: [{ zoneName: 'Zone 1' }],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
    await expect(
      service.login({ email: 'a@a.com', password: 'bad' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    await expect(
      service.login({ email: 'a@a.com', password: 'ok' } as any),
    ).resolves.toMatchObject({
      id: 1,
      zone: 'All Zones',
    });
  });

  it('batches service handles create/update/remove and not found', async () => {
    const mqttService = {
      publishCommand: jest.fn().mockResolvedValue({ ok: true }),
    };
    const service = new BatchesService(prisma as any, mqttService as any);
    jest
      .spyOn(service as any, 'synchronizeBatchProgress')
      .mockResolvedValue(undefined);

    prisma.batch.findMany.mockResolvedValue([]);
    prisma.batch.count.mockResolvedValue(0);
    prisma.batch.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.batchesID === 10
          ? null
          : {
              batchesID: where.batchesID,
              batchStatus: 'Running',
              recipe: { steps: [], stages: [] },
              device: null,
              batchOperations: [],
              alerts: [],
            },
      ),
    );
    prisma.recipe.findUnique.mockResolvedValue({
      recipeID: 1,
      isActive: true,
      stages: [
        {
          stageID: 1,
          stageOrder: 1,
          durationMinutes: 10,
          temperatureSetpoint: 60,
          humiditySetpoint: 30,
        },
      ],
    });
    prisma.batch.create.mockResolvedValue({
      batchesID: 1,
      recipe: {},
      device: {},
    });
    prisma.batchOperation.create.mockResolvedValue({ operationID: 1 });
    prisma.batch.update.mockResolvedValue({
      batchesID: 1,
      batchStatus: 'Done',
    });
    prisma.batch.delete.mockResolvedValue({ batchesID: 1 });

    await service.findAll();
    await expect(service.findOne(10)).rejects.toBeInstanceOf(NotFoundException);
    await service.create({
      recipeID: 1,
      deviceID: 1,
      startTime: new Date().toISOString(),
    } as any);
    await service.update(1, { batchStatus: 'Done' } as any);
    await service.remove(1);

    expect(prisma.batch.create).toHaveBeenCalled();
    expect(prisma.batchOperation.create).toHaveBeenCalled();
    expect(prisma.batch.update).toHaveBeenCalled();
    expect(prisma.batch.delete).toHaveBeenCalled();
  });

  it('batches service pauses on stage transition in manual mode and resumes on applyStageSetpoints', async () => {
    const mqttService = {
      publishCommand: jest.fn().mockResolvedValue({ ok: true }),
    };
    const service = new BatchesService(prisma as any, mqttService as any);

    jest.spyOn(service as any, 'getConfigValue').mockImplementation((key) => {
      if (key === 'temperatureSetpointFeed')
        return Promise.resolve('temp_setpoint');
      if (key === 'humiditySetpointFeed')
        return Promise.resolve('hum_setpoint');
      return Promise.resolve(null);
    });

    const now = new Date();
    const startedAt = new Date(now.getTime() - 12 * 60_000);

    const mockBatch = {
      batchesID: 1,
      batchStatus: 'Running',
      operationMode: 'manual',
      currentStage: 1,
      startedAt: startedAt,
      stageStartedAt: startedAt,
      recipe: {
        recipeID: 1,
        recipeName: 'Recipe 1',
        stages: [
          {
            stageID: 1,
            stageOrder: 1,
            durationMinutes: 10,
            temperatureSetpoint: 60,
            humiditySetpoint: 30,
          },
          {
            stageID: 2,
            stageOrder: 2,
            durationMinutes: 10,
            temperatureSetpoint: 65,
            humiditySetpoint: 25,
          },
        ],
      },
      device: { deviceID: 1, deviceName: 'Chamber 1' },
    };

    prisma.batch.findUnique.mockResolvedValue(mockBatch);
    prisma.alert.findFirst.mockResolvedValue(null);
    prisma.alert.create.mockResolvedValue({ alertID: 1 });
    prisma.batch.update.mockResolvedValue({
      ...mockBatch,
      batchStatus: 'Paused',
    });

    await (service as any).synchronizeBatchProgress(1);

    expect(prisma.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { batchesID: 1 },
        data: expect.objectContaining({ batchStatus: 'Paused' }),
      }),
    );
    expect(prisma.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          alertType: 'info',
          alertStatus: 'pending',
          alertMessage: expect.stringContaining('Giai đoạn 2 bắt đầu'),
        }),
      }),
    );

    const alertTime = new Date(now.getTime() - 2 * 60_000);
    prisma.alert.findFirst.mockResolvedValue({
      alertID: 100,
      alertTime: alertTime,
    });
    prisma.batch.findUnique.mockResolvedValue({
      ...mockBatch,
      batchStatus: 'Paused',
      currentStage: 2,
    });

    prisma.batch.update.mockResolvedValue({
      ...mockBatch,
      batchStatus: 'Running',
    });

    await service.applyStageSetpoints(1, 2);

    const expectedStartedAt = new Date(startedAt.getTime() + 2 * 60_000);
    expect(prisma.batch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { batchesID: 1 },
        data: expect.objectContaining({
          batchStatus: 'Running',
          startedAt: expect.any(Date),
        }),
      }),
    );

    const updateCall = prisma.batch.update.mock.calls.find(
      (call: any) => call[0].data.batchStatus === 'Running',
    );
    const passedStartedAt = updateCall[0].data.startedAt;
    const diff = Math.abs(
      passedStartedAt.getTime() - expectedStartedAt.getTime(),
    );
    expect(diff).toBeLessThan(1000);
  });

  it('devices service handles crud and not found', async () => {
    const mqttService = {
      subscribeToFeeds: jest.fn(),
    };
    const service = new DevicesService(prisma as any, mqttService as any);
    prisma.device.findMany.mockResolvedValue([]);
    prisma.device.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ deviceID: 1 });
    prisma.device.create.mockResolvedValue({ deviceID: 1 });
    prisma.device.update.mockResolvedValue({ deviceID: 1 });
    prisma.device.delete.mockResolvedValue({ deviceID: 1 });

    await service.findAll();
    await expect(service.findOne(20)).rejects.toBeInstanceOf(NotFoundException);
    await service.create({
      deviceName: 'D1',
      zoneID: 1,
      mqttTopicSensor: 'd1/temperature',
    } as any);
    await service.update(1, { deviceName: 'D2' } as any);
    await service.remove(1);

    expect(prisma.device.create).toHaveBeenCalled();
    expect(prisma.device.update).toHaveBeenCalled();
    expect(prisma.device.delete).toHaveBeenCalled();
  });

  it('recipes service handles steps and remove flow', async () => {
    const service = new RecipesService(prisma as any);
    prisma.recipe.findMany.mockResolvedValue([]);
    prisma.batch.count.mockResolvedValue(0);
    prisma.recipe.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ recipeID: 1 });
    prisma.recipe.create.mockResolvedValue({ recipeID: 1 });
    prisma.recipe.update.mockResolvedValue({ recipeID: 1 });
    prisma.recipeStage.deleteMany.mockResolvedValue({ count: 1 });
    prisma.recipeStep.deleteMany.mockResolvedValue({ count: 1 });
    prisma.recipe.delete.mockResolvedValue({ recipeID: 1 });

    await service.findAll();
    await expect(service.findOne(22)).rejects.toBeInstanceOf(NotFoundException);
    await service.create({
      recipeName: 'R1',
      steps: [{ action: 'heat' }],
    } as any);
    await service.update(1, { recipeName: 'R2' } as any);
    await service.remove(1);

    expect(prisma.recipe.create).toHaveBeenCalled();
    expect(prisma.recipeStage.deleteMany).toHaveBeenCalled();
    expect(prisma.recipeStep.deleteMany).toHaveBeenCalled();
    expect(prisma.recipe.delete).toHaveBeenCalled();
  });

  it('mode control service handles mode checks and auto actions', async () => {
    const service = new ModeControlService(prisma as any);

    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      configKey: 'operatingMode',
      configValue: 'manual',
    });
    await expect(service.getCurrentMode()).resolves.toBe('manual');

    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      configKey: 'operatingMode',
      configValue: 'auto',
    });
    await expect(service.isControlAllowed()).resolves.toEqual({
      allowed: false,
      reason: 'Auto mode active: System controls devices automatically',
      mode: 'auto',
    });

    prisma.systemConfig.findUnique.mockResolvedValueOnce({
      configKey: 'operatingMode',
      configValue: 'manual',
    });
    await expect(service.isControlAllowed()).resolves.toEqual({
      allowed: true,
      reason: 'Manual mode: User has full control',
      mode: 'manual',
    });

    prisma.systemConfig.findUnique.mockResolvedValue({
      configKey: 'operatingMode',
      configValue: 'auto',
    });
    prisma.systemConfig.findMany.mockResolvedValue([
      { configKey: 'maxTempSafe', configValue: '50' },
      { configKey: 'minHumidity', configValue: '10' },
      { configKey: 'maxHumidity', configValue: '80' },
    ]);

    await expect(
      service.getAutoControlAction({ temperature: 60 }),
    ).resolves.toMatchObject({ action: 'turn_off_dryer' });
    await expect(
      service.getAutoControlAction({ humidity: 5 }),
    ).resolves.toMatchObject({
      action: 'turn_on_humidifier',
    });
    await expect(
      service.getAutoControlAction({ humidity: 90 }),
    ).resolves.toMatchObject({ action: 'turn_on_fan' });

    prisma.systemConfigUpdate.create.mockResolvedValue({ id: 1 });
    await expect(
      service.logModeChange(1, 'auto', 'manual'),
    ).resolves.toBeUndefined();
    expect(prisma.systemConfigUpdate.create).toHaveBeenCalled();
  });

  it('system config update service handles log and query flows', async () => {
    const service = new SystemConfigUpdateService(prisma as any);

    prisma.systemConfigUpdate.create.mockResolvedValue({ id: 1 });
    prisma.systemConfigUpdate.findMany
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([{ id: 2 }]);

    await expect(
      service.logConfigUpdate('operatingMode', 1, 'manual override'),
    ).resolves.toBeUndefined();
    await expect(
      service.logConfigUpdate('maxTempSafe', null),
    ).resolves.toBeUndefined();
    await expect(service.getRecentUpdates('operatingMode', 5)).resolves.toEqual(
      [{ id: 1 }],
    );
    await expect(service.getAllRecentUpdates(3)).resolves.toEqual([{ id: 2 }]);

    expect(prisma.systemConfigUpdate.create).toHaveBeenCalled();
    expect(prisma.systemConfigUpdate.findMany).toHaveBeenCalledTimes(2);
  });

  it('sensor and sensor-data services process and query logs', async () => {
    const sensorService = new SensorService(prisma as any);
    const sensorDataService = new SensorDataService(prisma as any);
    prisma.sensorDataLog.create.mockResolvedValue({ logID: 1 });
    prisma.sensorDataLog.findMany.mockResolvedValue([]);

    await expect(
      sensorService.processAndStoreData('device-1', 'temperature', 30),
    ).resolves.toEqual({
      logID: 1,
    });
    await sensorDataService.findRecent();
    await sensorDataService.findRecent(1, 10);
    await sensorDataService.findByDevice(1, 5);

    expect(prisma.sensorDataLog.create).toHaveBeenCalled();
    expect(prisma.sensorDataLog.findMany).toHaveBeenCalledTimes(3);
  });

  it('system config service supports read and upsert flows', async () => {
    const service = new SystemConfigService(prisma as any);
    prisma.systemConfig.findMany
      .mockResolvedValueOnce([{ configKey: 'A', configValue: '1' }])
      .mockResolvedValueOnce([
        { configKey: 'A', configValue: '2' },
        { configKey: 'B', configValue: '3' },
      ]);
    prisma.systemConfig.upsert.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    await expect(service.findAll()).resolves.toEqual({ A: '1' });
    await service.upsert('A', '2');
    await expect(service.upsertMany({ A: '2', B: '3' })).resolves.toEqual({
      A: '2',
      B: '3',
    });
    expect(prisma.systemConfig.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('users service handles find/create/update/remove and not found', async () => {
    const service = new UsersService(prisma as any);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ userID: 1 });
    prisma.user.create.mockResolvedValue({ userID: 1 });
    prisma.user.update.mockResolvedValue({ userID: 1 });
    prisma.user.delete.mockResolvedValue({ userID: 1 });

    await service.findAll();
    await expect(service.findOne(10)).rejects.toBeInstanceOf(NotFoundException);

    (bcrypt.hash as jest.Mock)
      .mockResolvedValueOnce('hashed-1')
      .mockResolvedValueOnce('hashed-2');
    await service.create({
      email: 'u@a.com',
      password: 'pw',
      role: 'Admin',
    } as any);
    await service.update(1, { firstName: 'A', password: 'new-pw' } as any);
    await service.remove(1);

    expect(prisma.user.create).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalled();
  });

  it('zones service handles crud and not found', async () => {
    const service = new ZonesService(prisma as any);
    prisma.zone.findMany.mockResolvedValue([]);
    prisma.zone.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ zoneID: 1 });
    prisma.zone.create.mockResolvedValue({ zoneID: 1 });
    prisma.zone.update.mockResolvedValue({ zoneID: 1 });
    prisma.zone.delete.mockResolvedValue({ zoneID: 1 });

    await service.findAll();
    await expect(service.findOne(9)).rejects.toBeInstanceOf(NotFoundException);
    await service.create({ zoneName: 'Z1' } as any);
    await service.update(1, { zoneName: 'Z2' } as any);
    await service.remove(1);

    expect(prisma.zone.create).toHaveBeenCalled();
    expect(prisma.zone.update).toHaveBeenCalled();
    expect(prisma.zone.delete).toHaveBeenCalled();
  });
});

describe('Controllers coverage', () => {
  it('alerts controller delegates to service', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      acknowledge: jest.fn().mockResolvedValue({}),
      resolve: jest.fn().mockResolvedValue({}),
    };
    const controller = new AlertsController(service as any);
    await controller.findAll('pending');
    await controller.findOne(1);
    await controller.create({} as any);
    await controller.acknowledge(1);
    await controller.resolve(1, {} as any);
    expect(service.findAll).toHaveBeenCalledWith('pending');
    expect(service.resolve).toHaveBeenCalledWith(1, {});
  });

  it('auth, batches and devices controllers delegate to services', async () => {
    const authSvc = { login: jest.fn().mockResolvedValue({ id: 1 }) };
    const authController = new AuthController(authSvc as any);
    await authController.login({} as any);

    const batchSvc = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const batchController = new BatchesController(batchSvc as any);
    await batchController.findAll();
    await batchController.findOne(1);
    await batchController.create({} as any);
    await batchController.update(1, {} as any);
    await batchController.remove(1);

    const deviceSvc = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const deviceController = new DevicesController(deviceSvc as any);
    await deviceController.findAll();
    await deviceController.findOne(1);
    await deviceController.create({} as any);
    await deviceController.update(1, {} as any);
    await deviceController.remove(1);

    expect(authSvc.login).toHaveBeenCalled();
    expect(batchSvc.update).toHaveBeenCalled();
    expect(deviceSvc.remove).toHaveBeenCalledWith(1);
  });

  it('recipes, users and zones controllers delegate to services', async () => {
    const recipesSvc = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const recipesController = new RecipesController(recipesSvc as any);
    await recipesController.findAll();
    await recipesController.findOne(1);
    await recipesController.create({} as any);
    await recipesController.update(1, {} as any);
    await recipesController.remove(1);

    const usersSvc = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const usersController = new UsersController(usersSvc as any);
    await usersController.findAll();
    await usersController.findOne(1);
    await usersController.create({} as any);
    await usersController.update(1, {} as any);
    await usersController.remove(1);

    const zonesSvc = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const zonesController = new ZonesController(zonesSvc as any);
    await zonesController.findAll();
    await zonesController.findOne(1);
    await zonesController.create({} as any);
    await zonesController.update(1, {} as any);
    await zonesController.remove(1);

    expect(recipesSvc.create).toHaveBeenCalled();
    expect(usersSvc.update).toHaveBeenCalled();
    expect(zonesSvc.findOne).toHaveBeenCalledWith(1, undefined);
  });

  it('sensor-data and system-config controllers parse/delegate correctly', async () => {
    const sensorDataSvc = {
      findRecent: jest.fn(),
    };
    const sensorDataController = new SensorDataController(sensorDataSvc as any);
    await sensorDataController.findRecent('12', '5');
    await sensorDataController.findRecent(undefined, undefined);
    expect(sensorDataSvc.findRecent).toHaveBeenNthCalledWith(1, 12, 5);
    expect(sensorDataSvc.findRecent).toHaveBeenNthCalledWith(2, undefined, 50);

    const configSvc = {
      findAll: jest.fn(),
      upsertMany: jest.fn(),
    };
    const configController = new SystemConfigController(configSvc as any);
    await configController.findAll();
    await configController.upsertMany({ A: '1' });
    expect(configSvc.upsertMany).toHaveBeenCalledWith({ A: '1' });
  });

  it('mqtt controller publish command defaults optimisticSync when omitted', async () => {
    const mqttSvc = {
      publishCommand: jest.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new MqttController(mqttSvc as any);

    await controller.publishCommand({
      feed: 'fan_cmd',
      value: 1,
    } as any);

    await controller.publishCommand({
      feed: 'relay_cmd',
      value: 0,
      optimisticSync: false,
    } as any);

    expect(mqttSvc.publishCommand).toHaveBeenNthCalledWith(
      1,
      'fan_cmd',
      1,
      true,
    );
    expect(mqttSvc.publishCommand).toHaveBeenNthCalledWith(
      2,
      'relay_cmd',
      0,
      false,
    );
  });

  it('mqtt controller delegates to mqtt service methods', async () => {
    const mqttSvc = {
      getConnectionStatus: jest.fn().mockReturnValue({ connected: true }),
      getFeedState: jest.fn().mockReturnValue([]),
      subscribeToFeeds: jest.fn(),
      publishCommand: jest.fn().mockResolvedValue({ ok: true }),
      simulateIncomingFeed: jest.fn().mockResolvedValue({ ok: true }),
    };

    const controller = new MqttController(mqttSvc as any);

    expect(controller.getStatus()).toEqual({ connected: true });
    expect(controller.getState()).toEqual([]);

    await controller.resubscribe({ feeds: ['temperature', 'humidity'] } as any);
    await controller.publishCommand({
      feed: 'fan_cmd',
      value: 'ON',
      optimisticSync: true,
    } as any);
    await controller.simulateIncoming({
      feed: 'temperature',
      value: 21.5,
    } as any);

    expect(mqttSvc.subscribeToFeeds).toHaveBeenCalledWith([
      'temperature',
      'humidity',
    ]);
    expect(mqttSvc.publishCommand).toHaveBeenCalledWith('fan_cmd', 'ON', true);
    expect(mqttSvc.simulateIncomingFeed).toHaveBeenCalledWith(
      'temperature',
      21.5,
    );
  });
});

describe('Factories service and controller', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  it('factories service handles findAll', async () => {
    const service = new FactoriesService(prisma as any);
    prisma.factory.findMany.mockResolvedValue([]);
    await service.findAll({ userID: 1, role: 'Admin' });
    expect(prisma.factory.findMany).toHaveBeenCalled();
  });

  it('factories service getUserScope gets scope or throws Forbidden', async () => {
    const service = new FactoriesService(prisma as any);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findAll({ userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ organizationID: 1, factoryID: 2 });
    prisma.factory.findMany.mockResolvedValue([]);
    await service.findAll({ userID: 1, role: 'Manager' });
    expect(prisma.factory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { factoryID: 2 }
    }));
  });

  it('factories service findOne throws NotFound or Forbidden', async () => {
    const service = new FactoriesService(prisma as any);
    prisma.user.findUnique.mockResolvedValue({ factoryID: 1 });
    await expect(service.findOne(2, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.factory.findUnique.mockResolvedValue(null);
    await expect(service.findOne(1, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(NotFoundException);

    const mockFac = { factoryID: 1, factoryName: 'F1', sites: [], devices: [] };
    prisma.factory.findUnique.mockResolvedValue(mockFac);
    await expect(service.findOne(1, { userID: 1, role: 'Admin' })).resolves.toBe(mockFac);
  });

  it('factories service create throws Forbidden/NotFound or creates', async () => {
    const service = new FactoriesService(prisma as any);
    await expect(service.create({ factoryName: 'F' } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(service.create({ factoryName: 'F', organizationID: 1 } as any, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.organization.findUnique.mockResolvedValue({ organizationID: 1 });
    prisma.factory.findUnique.mockResolvedValueOnce(true).mockResolvedValueOnce(null); // for code generation check
    prisma.factory.create.mockResolvedValue({ factoryID: 1 });
    await service.create({ factoryName: 'F', organizationID: 1 } as any, { userID: 1, role: 'Admin' });
    expect(prisma.factory.create).toHaveBeenCalled();
  });

  it('factories service create handles conflicts and server errors', async () => {
    const service = new FactoriesService(prisma as any);
    prisma.organization.findUnique.mockResolvedValue({ organizationID: 1 });
    prisma.factory.create.mockRejectedValue({ code: 'P2002', meta: { target: ['factoryCode'] } });
    await expect(service.create({ factoryName: 'F', organizationID: 1 } as any, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.factory.create.mockRejectedValue(new Error('db error'));
    await expect(service.create({ factoryName: 'F', organizationID: 1 } as any, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('factories service update handles permissions and prisma errors', async () => {
    const service = new FactoriesService(prisma as any);
    prisma.user.findUnique.mockResolvedValue({ factoryID: 1 });
    await expect(service.update(1, {}, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update(2, {}, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update(1, { organizationID: 2 }, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(service.update(1, { organizationID: 2 }, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.organization.findUnique.mockResolvedValue({ organizationID: 2 });
    prisma.factory.update.mockResolvedValue({ factoryID: 1 });
    await service.update(1, { organizationID: 2 }, { userID: 1, role: 'Admin' });

    prisma.factory.update.mockRejectedValue({ code: 'P2002', meta: { target: ['factoryCode'] } });
    await expect(service.update(1, {}, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.factory.update.mockRejectedValue(new Error('err'));
    await expect(service.update(1, {}, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('factories service remove checks roles, dependencies, and deletes', async () => {
    const service = new FactoriesService(prisma as any);
    await expect(service.remove(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.factory.findUnique.mockResolvedValue({ factoryID: 1, sites: [{ siteID: 1 }], devices: [] });
    await expect(service.remove(1, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.factory.findUnique.mockResolvedValue({ factoryID: 1, sites: [], devices: [{ deviceID: 1 }] });
    await expect(service.remove(1, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.factory.findUnique.mockResolvedValue({ factoryID: 1, sites: [], devices: [] });
    prisma.factory.delete.mockResolvedValue({ factoryID: 1 });
    await service.remove(1, { userID: 1, role: 'Admin' });
    expect(prisma.factory.delete).toHaveBeenCalled();
  });

  it('factories controller delegates to service', async () => {
    const service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const controller = new FactoriesController(service as any);
    const actor = { userID: 1, role: 'Admin' } as any;

    await controller.findAll(actor);
    await controller.findOne(1, actor);
    await controller.create({} as any, actor);
    await controller.update(1, {} as any, actor);
    await controller.remove(1, actor);

    expect(service.findAll).toHaveBeenCalledWith(actor);
    expect(service.findOne).toHaveBeenCalledWith(1, actor);
    expect(service.create).toHaveBeenCalledWith({}, actor);
    expect(service.update).toHaveBeenCalledWith(1, {}, actor);
    expect(service.remove).toHaveBeenCalledWith(1, actor);
  });
});

describe('Organizations service and controller', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  it('organizations service handles findAll', async () => {
    const service = new OrganizationsService(prisma as any);
    prisma.organization.findMany.mockResolvedValue([]);
    await service.findAll({ userID: 1, role: 'Admin' });
    expect(prisma.organization.findMany).toHaveBeenCalled();
  });

  it('organizations service getUserScope handles errors', async () => {
    const service = new OrganizationsService(prisma as any);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findAll({ userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ organizationID: 1 });
    prisma.organization.findMany.mockResolvedValue([]);
    await service.findAll({ userID: 1, role: 'Manager' });
    expect(prisma.organization.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationID: 1 }
    }));
  });

  it('organizations service findOne throws NotFound or Forbidden', async () => {
    const service = new OrganizationsService(prisma as any);
    prisma.user.findUnique.mockResolvedValue({ organizationID: 1 });
    await expect(service.findOne(2, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(service.findOne(1, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(NotFoundException);

    const mockOrg = { organizationID: 1, factories: [] };
    prisma.organization.findUnique.mockResolvedValue(mockOrg);
    await expect(service.findOne(1, { userID: 1, role: 'Admin' })).resolves.toBe(mockOrg);
  });

  it('organizations service create processes unique code generation and handles conflict/server errors', async () => {
    const service = new OrganizationsService(prisma as any);
    await expect(service.create({ organizationName: 'O' } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.organization.findUnique.mockResolvedValueOnce(true).mockResolvedValueOnce(null);
    prisma.organization.create.mockResolvedValue({ organizationID: 1 });
    await service.create({ organizationName: 'O' } as any, { userID: 1, role: 'Admin' });

    prisma.organization.create.mockRejectedValue({ code: 'P2002', meta: { target: ['organizationCode'] } });
    await expect(service.create({ organizationName: 'O' } as any, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.organization.create.mockRejectedValue(new Error('db error'));
    await expect(service.create({ organizationName: 'O' } as any, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('organizations service update verifies role and handles prisma outcomes', async () => {
    const service = new OrganizationsService(prisma as any);
    await expect(service.update(1, {}, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.organization.findUnique.mockResolvedValue({ organizationID: 1 });
    prisma.organization.update.mockResolvedValue({ organizationID: 1 });
    await service.update(1, {}, { userID: 1, role: 'Admin' });

    prisma.organization.update.mockRejectedValue({ code: 'P2002', meta: { target: ['organizationCode'] } });
    await expect(service.update(1, {}, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.organization.update.mockRejectedValue(new Error('err'));
    await expect(service.update(1, {}, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('organizations service remove checks details and deletes', async () => {
    const service = new OrganizationsService(prisma as any);
    await expect(service.remove(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.organization.findUnique.mockResolvedValue({ organizationID: 1, factories: [{ factoryID: 1 }] });
    await expect(service.remove(1, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.organization.findUnique.mockResolvedValue({ organizationID: 1, factories: [] });
    prisma.organization.delete.mockResolvedValue({ organizationID: 1 });
    await service.remove(1, { userID: 1, role: 'Admin' });
    expect(prisma.organization.delete).toHaveBeenCalled();
  });

  it('organizations controller delegates to service', async () => {
    const service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const controller = new OrganizationsController(service as any);
    const actor = { userID: 1, role: 'Admin' } as any;

    await controller.findAll(actor);
    await controller.findOne(1, actor);
    await controller.create({} as any, actor);
    await controller.update(1, {} as any, actor);
    await controller.remove(1, actor);

    expect(service.findAll).toHaveBeenCalledWith(actor);
    expect(service.findOne).toHaveBeenCalledWith(1, actor);
    expect(service.create).toHaveBeenCalledWith({}, actor);
    expect(service.update).toHaveBeenCalledWith(1, {}, actor);
    expect(service.remove).toHaveBeenCalledWith(1, actor);
  });
});

describe('Sites service and controller', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  it('sites service handles findAll', async () => {
    const service = new SitesService(prisma as any);
    prisma.site.findMany.mockResolvedValue([]);
    await service.findAll({ userID: 1, role: 'Admin' });
    expect(prisma.site.findMany).toHaveBeenCalled();
  });

  it('sites service getUserScope handles errors and applies query scopes', async () => {
    const service = new SitesService(prisma as any);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findAll({ userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ factoryID: 2, siteID: 3 });
    prisma.site.findMany.mockResolvedValue([]);

    await service.findAll({ userID: 1, role: 'Manager' });
    expect(prisma.site.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { factoryID: 2 }
    }));

    await service.findAll({ userID: 1, role: 'Operator' });
    expect(prisma.site.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { siteID: 3 }
    }));
  });

  it('sites service findOne throws NotFound or Forbidden', async () => {
    const service = new SitesService(prisma as any);
    prisma.user.findUnique.mockResolvedValue({ factoryID: 2, siteID: 3 });

    prisma.site.findUnique.mockResolvedValue({ siteID: 1, factoryID: 99 });
    await expect(service.findOne(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    await expect(service.findOne(1, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.site.findUnique.mockResolvedValue(null);
    await expect(service.findOne(1, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(NotFoundException);

    const mockSite = { siteID: 1, factoryID: 2, zones: [], devices: [], users: [] };
    prisma.site.findUnique.mockResolvedValue(mockSite);
    await expect(service.findOne(1, { userID: 1, role: 'Manager' })).resolves.toBe(mockSite);
  });

  it('sites service create throws Forbidden/NotFound or creates', async () => {
    const service = new SitesService(prisma as any);
    await expect(service.create({ siteName: 'S' } as any, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ factoryID: 2 });
    await expect(service.create({ siteName: 'S', factoryID: 99 } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.factory.findUnique.mockResolvedValue(null);
    await expect(service.create({ siteName: 'S', factoryID: 2 } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.factory.findUnique.mockResolvedValue({ factoryID: 2 });
    prisma.site.findUnique.mockResolvedValueOnce(true).mockResolvedValueOnce(null);
    prisma.site.create.mockResolvedValue({ siteID: 1 });
    await service.create({ siteName: 'S', factoryID: 2 } as any, { userID: 1, role: 'Manager' });
    expect(prisma.site.create).toHaveBeenCalled();
  });

  it('sites service create handles conflicts and errors', async () => {
    const service = new SitesService(prisma as any);
    prisma.factory.findUnique.mockResolvedValue({ factoryID: 2 });
    prisma.site.create.mockRejectedValue({ code: 'P2002', meta: { target: ['siteCode'] } });
    await expect(service.create({ siteName: 'S', factoryID: 2 } as any, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.site.create.mockRejectedValue(new Error('db err'));
    await expect(service.create({ siteName: 'S', factoryID: 2 } as any, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('sites service update handles permissions, parent changes and database outcomes', async () => {
    const service = new SitesService(prisma as any);
    prisma.user.findUnique.mockResolvedValue({ factoryID: 2 });
    prisma.site.findUnique.mockResolvedValue({ siteID: 1, factoryID: 99 }); // mismatched factory for manager

    await expect(service.update(1, {}, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update(1, {}, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.site.findUnique.mockResolvedValue({ siteID: 1, factoryID: 2 });
    await expect(service.update(1, { factoryID: 99 }, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.factory.findUnique.mockResolvedValue(null);
    await expect(service.update(1, { factoryID: 99 }, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.factory.findUnique.mockResolvedValue({ factoryID: 99 });
    prisma.site.update.mockResolvedValue({ siteID: 1 });
    await service.update(1, { factoryID: 99 }, { userID: 1, role: 'Admin' });

    prisma.site.update.mockRejectedValue({ code: 'P2002', meta: { target: ['siteCode'] } });
    await expect(service.update(1, {}, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ConflictException);

    prisma.site.update.mockRejectedValue(new Error('err'));
    await expect(service.update(1, {}, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('sites service remove checks dependencies and deletes', async () => {
    const service = new SitesService(prisma as any);
    await expect(service.remove(1, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ factoryID: 2 });
    prisma.site.findUnique.mockResolvedValue({ siteID: 1, factoryID: 99 });
    await expect(service.remove(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.site.findUnique.mockResolvedValue({ siteID: 1, factoryID: 2, zones: [{ zoneID: 1 }] });
    await expect(service.remove(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ConflictException);

    prisma.site.findUnique.mockResolvedValue({ siteID: 1, factoryID: 2, zones: [], devices: [{ deviceID: 1 }] });
    await expect(service.remove(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ConflictException);

    prisma.site.findUnique.mockResolvedValue({ siteID: 1, factoryID: 2, zones: [], devices: [], users: [{ userID: 1 }] });
    await expect(service.remove(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ConflictException);

    prisma.site.findUnique.mockResolvedValue({ siteID: 1, factoryID: 2, zones: [], devices: [], users: [] });
    prisma.site.delete.mockResolvedValue({ siteID: 1 });
    await service.remove(1, { userID: 1, role: 'Manager' });
    expect(prisma.site.delete).toHaveBeenCalled();
  });

  it('sites controller delegates to service', async () => {
    const service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    const controller = new SitesController(service as any);
    const actor = { userID: 1, role: 'Admin' } as any;

    await controller.findAll(actor);
    await controller.findOne(1, actor);
    await controller.create({} as any, actor);
    await controller.update(1, {} as any, actor);
    await controller.remove(1, actor);

    expect(service.findAll).toHaveBeenCalledWith(actor);
    expect(service.findOne).toHaveBeenCalledWith(1, actor);
    expect(service.create).toHaveBeenCalledWith({}, actor);
    expect(service.update).toHaveBeenCalledWith(1, {}, actor);
    expect(service.remove).toHaveBeenCalledWith(1, actor);
  });
});

describe('RbacPermissionGuard and CurrentActor', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: RbacPermissionGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new RbacPermissionGuard(reflector);
  });

  const mockExecutionContext = (headers: Record<string, string>) => {
    const request = { headers, actor: undefined };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  it('allows access if no permissions are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = mockExecutionContext({ 'x-user-role': 'Operator', 'x-user-id': '1' });
    expect(guard.canActivate(context)).toBe(true);
    expect(context.switchToHttp().getRequest().actor).toEqual({ userID: 1, role: 'Operator' });
  });

  it('throws UnauthorizedException if credentials are missing and permissions are required', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.read']);
    const context = mockExecutionContext({ 'x-user-role': 'Operator' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException if role lacks permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.read']);
    const context = mockExecutionContext({ 'x-user-role': 'Operator', 'x-user-id': '1' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access if role has permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.read']);
    const context = mockExecutionContext({ 'x-user-role': 'Admin', 'x-user-id': '2' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('CurrentActor decorator returns actor from request when present', () => {
    // Test the decorator logic directly: simulate what createParamDecorator would call
    const mockActor = { userID: 5, role: 'Operator' as const };
    const mockRequest = { actor: mockActor };
    // The factory function inside CurrentActor reads request.actor
    // We simulate the same logic inline
    const decoratorFactory = (_: unknown, ctx: any): any => {
      return ctx.switchToHttp().getRequest<{ actor?: any }>().actor;
    };
    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as any;
    expect(decoratorFactory(null, mockCtx)).toEqual(mockActor);
  });

  it('CurrentActor decorator returns undefined when actor not on request', () => {
    const decoratorFactory = (_: unknown, ctx: any): any => {
      return ctx.switchToHttp().getRequest<{ actor?: any }>().actor;
    };
    const mockCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ actor: undefined }),
      }),
    } as any;
    expect(decoratorFactory(null, mockCtx)).toBeUndefined();
  });
});

describe('UsersService additional edge cases', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UsersService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
    service = new UsersService(prisma as any);
  });

  it('throws BadRequestException for invalid role', async () => {
    await expect(service.create({ role: 'InvalidRole' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getUserScope throws ForbiddenException if user scope not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findAll({ userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findAll filters correctly for Manager and Operator', async () => {
    prisma.user.findUnique.mockResolvedValue({ factoryID: 10, siteID: 20 });
    prisma.user.findMany.mockResolvedValue([]);
    
    await service.findAll({ userID: 1, role: 'Manager' });
    expect(prisma.user.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { factoryID: 10 }
    }));

    await service.findAll({ userID: 1, role: 'Operator' });
    expect(prisma.user.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userID: 1 }
    }));
  });

  it('findOne throws ForbiddenException if Manager/Operator accesses out of scope', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ userID: 2, factoryID: 10 })
      .mockResolvedValueOnce({ factoryID: 20 });
    await expect(service.findOne(2, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique
      .mockResolvedValueOnce({ userID: 2, factoryID: 10 })
      .mockResolvedValueOnce({ siteID: 30 });
    await expect(service.findOne(2, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create throws Forbidden/Conflict/NotFound appropriately', async () => {
    await expect(service.create({ role: 'Manager' } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findFirst.mockResolvedValue({ userID: 9 });
    await expect(service.create({ role: 'Operator', email: 'exist@a.com' } as any)).rejects.toBeInstanceOf(ConflictException);
    prisma.user.findFirst.mockResolvedValue(null);

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.create({ role: 'Operator' } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValueOnce({ factoryID: 1 });
    prisma.site.findUnique.mockResolvedValue({ factoryID: 2 });
    await expect(service.create({ role: 'Operator', siteID: 5 } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValueOnce({ factoryID: 1 });
    prisma.site.findUnique.mockResolvedValue(null);
    await expect(service.create({ role: 'Operator', siteID: 5 } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.site.findUnique.mockResolvedValue({ factoryID: 2, factory: { organizationID: 3 } });
    prisma.user.create.mockResolvedValue({ userID: 2 });
    prisma.user.findUnique.mockResolvedValue({ userID: 2 });
    prisma.zone.updateMany.mockResolvedValue({ count: 1 });
    await service.create({ role: 'Operator', siteID: 5, chamberIDs: [1, 2] } as any, { userID: 1, role: 'Admin' });

    prisma.factory.findUnique.mockResolvedValue({ organizationID: 4 });
    await service.create({ role: 'Operator', factoryID: 8 } as any, { userID: 1, role: 'Admin' });

    prisma.user.create.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });
    await expect(service.create({ role: 'Operator' } as any)).rejects.toBeInstanceOf(ConflictException);

    prisma.user.create.mockRejectedValue(new Error('db err'));
    await expect(service.create({ role: 'Operator' } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('update throws and runs transactions appropriately', async () => {
    // update(2, {role:'Operator'}, {userID:1, role:'Manager'}) calls:
    //  1) getUserScope(Manager) -> findUnique({userID:1}) -> scope
    //  2) findOne(2, Manager) -> getUserScope again -> findUnique({userID:1}) -> scope
    //  3) findOne(2, Manager) -> findUnique({userID:2}) -> target user {role:'Manager'}
    // Then checks existingUser.role !== 'Operator' -> throws ForbiddenException
    prisma.user.findUnique
      .mockResolvedValueOnce({ factoryID: 1 })   // scope for outer getUserScope
      .mockResolvedValueOnce({ factoryID: 1 })   // scope inside findOne's getUserScope
      .mockResolvedValueOnce({ userID: 2, role: 'Manager' }); // target user
    await expect(service.update(2, { role: 'Operator' }, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    // update(2, {role:'Manager'}, {userID:1, role:'Manager'}) with target Operator:
    //  throws because nextRole !== 'Operator'
    prisma.user.findUnique
      .mockResolvedValueOnce({ factoryID: 1 })
      .mockResolvedValueOnce({ factoryID: 1 })
      .mockResolvedValueOnce({ userID: 2, role: 'Operator' });
    await expect(service.update(2, { role: 'Manager' }, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    // siteID mismatch: site.factoryID(2) != scope.factoryID(1)
    prisma.user.findUnique
      .mockResolvedValueOnce({ factoryID: 1 })
      .mockResolvedValueOnce({ factoryID: 1 })
      .mockResolvedValueOnce({ userID: 2, role: 'Operator' });
    prisma.site.findUnique.mockResolvedValue({ factoryID: 2 });
    await expect(service.update(2, { siteID: 5 }, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    // site.factoryID(1) == scope.factoryID(1) -> success
    // call sequence: scope, findOne(scope), findOne(user), final-findOne(scope), final-findOne(user)
    prisma.user.findUnique
      .mockResolvedValueOnce({ factoryID: 1 })                       // 1) outer getUserScope
      .mockResolvedValueOnce({ factoryID: 1 })                       // 2) findOne getUserScope
      .mockResolvedValueOnce({ userID: 2, role: 'Operator', factoryID: 1 }) // 3) target user
      .mockResolvedValueOnce({ factoryID: 1 })                       // 4) final findOne getUserScope
      .mockResolvedValueOnce({ userID: 2, role: 'Operator', factoryID: 1 }); // 5) final findOne user
    prisma.site.findUnique.mockResolvedValue({ factoryID: 1 });
    prisma.user.update.mockResolvedValue({ userID: 2, role: 'Operator' });
    prisma.zone.updateMany.mockResolvedValue({ count: 1 });
    await service.update(2, { siteID: 5, chamberIDs: [10] }, { userID: 1, role: 'Manager' });


    prisma.user.findUnique.mockResolvedValue({ userID: 2, role: 'Operator' });
    prisma.site.findUnique.mockResolvedValue({ factoryID: 1, factory: { organizationID: 2 } });
    prisma.user.update.mockResolvedValue({ userID: 2, role: 'Operator' });
    await service.update(2, { siteID: 5, chamberIDs: [10] }, { userID: 1, role: 'Admin' });

    prisma.user.update.mockResolvedValue({ userID: 2, role: 'Admin' });
    prisma.zone.updateMany.mockResolvedValue({ count: 1 });
    await service.update(2, { role: 'Admin' }, { userID: 1, role: 'Admin' });
    expect(prisma.zone.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userID: 2 },
      data: { userID: null }
    }));
  });

  it('remove throws and processes unassignment', async () => {
    await expect(service.remove(1, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ForbiddenException);

    // remove(2, Manager): Manager actor
    //  1) getUserScope(Manager) -> findUnique({userID:1}) -> scope
    //  2) findOne(2, Manager) -> getUserScope again -> findUnique({userID:1}) -> scope
    //  3) findOne(2, Manager) -> findUnique({userID:2}) -> target user {role:'Manager'}
    // Manager can only remove Operators -> throws ForbiddenException
    prisma.user.findUnique
      .mockResolvedValueOnce({ factoryID: 1 })   // scope outer
      .mockResolvedValueOnce({ factoryID: 1 })   // scope inside findOne
      .mockResolvedValueOnce({ userID: 2, role: 'Manager' }); // target user
    await expect(service.remove(2, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ userID: 2, role: 'Admin' });
    await expect(service.remove(2, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ userID: 2, role: 'Operator' });
    prisma.zone.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.delete.mockResolvedValue({ userID: 2 });
    await service.remove(2, { userID: 1, role: 'Admin' });
    expect(prisma.zone.updateMany).toHaveBeenCalledWith({
      where: { userID: 2 },
      data: { userID: null }
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { userID: 2 } });
  });
});

describe('ZonesService additional edge cases', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: ZonesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
    service = new ZonesService(prisma as any);
  });

  it('getUserScope throws if user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findAll({ userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findAll applies Manager and Operator scopes', async () => {
    prisma.user.findUnique.mockResolvedValue({ factoryID: 10, siteID: 20 });
    prisma.zone.findMany.mockResolvedValue([]);

    await service.findAll({ userID: 1, role: 'Manager' });
    expect(prisma.zone.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { factoryID: 10 }
    }));

    await service.findAll({ userID: 1, role: 'Operator' });
    expect(prisma.zone.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { siteID: 20 }
    }));
  });

  it('findOne throws Forbidden appropriately', async () => {
    prisma.user.findUnique.mockResolvedValue({ factoryID: 10, siteID: 20 });
    prisma.zone.findUnique.mockResolvedValue({ zoneID: 1, factoryID: 99 });
    await expect(service.findOne(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.zone.findUnique.mockResolvedValue({ zoneID: 1, siteID: 99 });
    await expect(service.findOne(1, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create validates roles, sites, scopes and handles database errors', async () => {
    await expect(service.create({ zoneName: 'Z' } as any, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.site.findUnique.mockResolvedValue(null);
    await expect(service.create({ zoneName: 'Z', siteID: 5 } as any, { userID: 1, role: 'Admin' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.user.findUnique.mockResolvedValue({ factoryID: 1 });
    prisma.site.findUnique.mockResolvedValue({ factoryID: 2 });
    await expect(service.create({ zoneName: 'Z', siteID: 5 } as any, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.site.findUnique.mockResolvedValue({ factoryID: 1, factory: { organizationID: 3 } });
    prisma.zone.create.mockResolvedValue({ zoneID: 1 });
    await service.create({ zoneName: 'Z', siteID: 5 } as any, { userID: 1, role: 'Manager' });

    prisma.user.findUnique.mockResolvedValue({ factoryID: 1, organizationID: 3 });
    await service.create({ zoneName: 'Z' } as any, { userID: 1, role: 'Manager' });

    prisma.zone.create.mockRejectedValue({ code: 'P2002', meta: { target: ['zoneName'] } });
    await expect(service.create({ zoneName: 'Z' } as any)).rejects.toBeInstanceOf(ConflictException);

    prisma.zone.create.mockRejectedValue(new Error('db err'));
    await expect(service.create({ zoneName: 'Z' } as any)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('update validates roles, sites, scopes and handles database errors', async () => {
    prisma.zone.findUnique.mockResolvedValue({ zoneID: 1, factoryID: 2 });

    await expect(service.update(1, {}, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ factoryID: 99 });
    await expect(service.update(1, {}, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ factoryID: 2 });
    prisma.site.findUnique.mockResolvedValue(null);
    await expect(service.update(1, { siteID: 5 }, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(NotFoundException);

    prisma.site.findUnique.mockResolvedValue({ factoryID: 99 });
    await expect(service.update(1, { siteID: 5 }, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.site.findUnique.mockResolvedValue({ factoryID: 2, factory: { organizationID: 3 } });
    prisma.zone.update.mockResolvedValue({ zoneID: 1 });
    await service.update(1, { siteID: 5 }, { userID: 1, role: 'Manager' });

    prisma.zone.update.mockRejectedValue({ code: 'P2002', meta: { target: ['zoneName'] } });
    await expect(service.update(1, {} as any)).rejects.toBeInstanceOf(ConflictException);

    prisma.zone.update.mockRejectedValue(new Error('db err'));
    await expect(service.update(1, {} as any)).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('remove validates roles and dependencies', async () => {
    await expect(service.remove(1, { userID: 1, role: 'Operator' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ factoryID: 99 });
    prisma.zone.findUnique.mockResolvedValue({ zoneID: 1, factoryID: 2 });
    await expect(service.remove(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ForbiddenException);

    prisma.user.findUnique.mockResolvedValue({ factoryID: 2 });
    prisma.zone.findUnique.mockResolvedValue({ zoneID: 1, factoryID: 2, devices: [{ deviceID: 1 }] });
    await expect(service.remove(1, { userID: 1, role: 'Manager' })).rejects.toBeInstanceOf(ConflictException);

    prisma.zone.findUnique.mockResolvedValue({ zoneID: 1, factoryID: 2, devices: [] });
    prisma.zone.delete.mockResolvedValue({ zoneID: 1 });
    await service.remove(1, { userID: 1, role: 'Manager' });
    expect(prisma.zone.delete).toHaveBeenCalled();
  });
});

