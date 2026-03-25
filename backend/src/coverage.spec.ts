import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AlertsService } from './alerts/alerts.service';
import { AuthService } from './auth/auth.service';
import { BatchesService } from './batches/batches.service';
import { DevicesService } from './devices/devices.service';
import { RecipesService } from './recipes/recipes.service';
import { SensorService } from './sensor/sensor.service';
import { SensorDataService } from './sensor-data/sensor-data.service';
import { SystemConfigService } from './system-config/system-config.service';
import { UsersService } from './users/users.service';
import { ZonesService } from './zones/zones.service';
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

const createPrismaMock = () => ({
  alert: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
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
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
  sensorDataLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  systemConfig: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  zone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('Services coverage', () => {
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    jest.clearAllMocks();
  });

  it('alerts service handles find/create/resolve flow', async () => {
    const service = new AlertsService(prisma as any);
    prisma.alert.findMany.mockResolvedValue([]);
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
    const service = new BatchesService(prisma as any);
    prisma.batch.findMany.mockResolvedValue([]);
    prisma.batch.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ batchesID: 1 });
    prisma.batch.create.mockResolvedValue({ batchesID: 1 });
    prisma.batch.update.mockResolvedValue({
      batchesID: 1,
      batchStatus: 'Done',
    });
    prisma.batch.delete.mockResolvedValue({ batchesID: 1 });

    await service.findAll();
    await expect(service.findOne(10)).rejects.toBeInstanceOf(NotFoundException);
    await service.create({ recipeID: 1, deviceID: 1 } as any);
    await service.update(1, { batchStatus: 'Done' } as any);
    await service.remove(1);

    expect(prisma.batch.create).toHaveBeenCalled();
    expect(prisma.batch.update).toHaveBeenCalled();
    expect(prisma.batch.delete).toHaveBeenCalled();
  });

  it('devices service handles crud and not found', async () => {
    const service = new DevicesService(prisma as any);
    prisma.device.findMany.mockResolvedValue([]);
    prisma.device.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ deviceID: 1 });
    prisma.device.create.mockResolvedValue({ deviceID: 1 });
    prisma.device.update.mockResolvedValue({ deviceID: 1 });
    prisma.device.delete.mockResolvedValue({ deviceID: 1 });

    await service.findAll();
    await expect(service.findOne(20)).rejects.toBeInstanceOf(NotFoundException);
    await service.create({ deviceName: 'D1', zoneID: 1 } as any);
    await service.update(1, { deviceName: 'D2' } as any);
    await service.remove(1);

    expect(prisma.device.create).toHaveBeenCalled();
    expect(prisma.device.update).toHaveBeenCalled();
    expect(prisma.device.delete).toHaveBeenCalled();
  });

  it('recipes service handles steps and remove flow', async () => {
    const service = new RecipesService(prisma as any);
    prisma.recipe.findMany.mockResolvedValue([]);
    prisma.recipe.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ recipeID: 1 });
    prisma.recipe.create.mockResolvedValue({ recipeID: 1 });
    prisma.recipe.update.mockResolvedValue({ recipeID: 1 });
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
    expect(prisma.recipeStep.deleteMany).toHaveBeenCalled();
    expect(prisma.recipe.delete).toHaveBeenCalled();
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
    expect(zonesSvc.findOne).toHaveBeenCalledWith(1);
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
