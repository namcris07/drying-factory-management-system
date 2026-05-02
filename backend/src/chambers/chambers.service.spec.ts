import { NotFoundException } from '@nestjs/common';
import { ChambersController } from './chambers.controller';
import { ChambersService } from './chambers.service';

describe('ChambersService', () => {
  const createService = () => {
    const prisma = {
      device: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      sensorChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      actuatorChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      $executeRawUnsafe: jest.fn(),
    };

    const mqttService = {
      subscribeToFeeds: jest.fn(),
    };

    const service = new ChambersService(prisma as any, mqttService as any);
    return { service, prisma, mqttService };
  };

  it('findAll maps chamber description and sensors from metadata', async () => {
    const { service, prisma } = createService();

    prisma.device.findMany.mockResolvedValue([
      {
        deviceID: 1,
        deviceName: 'Chamber A',
        deviceStatus: 'Active',
        zoneID: 2,
        zone: { zoneName: 'Zone 2' },
        mqttTopicSensor: 'legacy/temp',
        metaData: {
          chamberDescription: 'Main line',
          sensors: [
            {
              sensorName: 'T1',
              sensorType: 'Temperature',
              feedKey: 'line-a/temp',
              status: 'Active',
            },
          ],
        },
      },
    ]);

    const rows = await service.findAll();

    expect(rows[0]).toMatchObject({
      chamberID: 1,
      chamberDescription: 'Main line',
      zoneName: 'Zone 2',
      sensors: [
        expect.objectContaining({
          feedKey: 'line-a/temp',
        }),
      ],
    });
  });

  it('findOne throws NotFoundException for missing chamber', async () => {
    const { service, prisma } = createService();
    prisma.device.findUnique.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create persists normalized sensors and subscribes mqtt feeds', async () => {
    const { service, prisma, mqttService } = createService();

    prisma.device.findMany.mockResolvedValue([]);
    prisma.device.create.mockResolvedValue({ deviceID: 5 });
    prisma.device.findUnique.mockResolvedValue({
      deviceID: 5,
      deviceName: 'Chamber 5',
      deviceStatus: 'Active',
      zoneID: 7,
      zone: { zoneName: 'Zone 7' },
      mqttTopicSensor: 'line5/temp',
      metaData: {
        chamberDescription: 'Desc',
        sensors: [
          {
            sensorName: 'Temp',
            sensorType: 'Temperature',
            feedKey: 'line5/temp',
            status: 'Active',
          },
        ],
      },
    });

    const created = await service.create({
      chamberName: 'Chamber 5',
      chamberDescription: 'Desc',
      zoneID: 7,
      sensors: [
        {
          sensorName: 'Temp',
          sensorType: 'Temperature',
          feedKey: 'line5/temp',
          status: 'Active',
        },
      ],
    } as any);

    expect(prisma.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deviceType: 'DryingChamber',
          mqttTopicSensor: 'line5/temp',
        }),
      }),
    );
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
    expect(mqttService.subscribeToFeeds).toHaveBeenCalledWith(['line5/temp']);
    expect(created).toMatchObject({ chamberID: 5 });
  });

  it('create persists normalized sensors and actuators and subscribes mqtt feeds', async () => {
    const { service, prisma } = createService();

    prisma.device.findMany.mockResolvedValue([]);
    prisma.device.create.mockResolvedValue({ deviceID: 9 });
    prisma.device.findUnique.mockResolvedValue({
      deviceID: 9,
      deviceName: 'Chamber 9',
      deviceStatus: 'Active',
      zoneID: 7,
      zone: { zoneName: 'Zone 7' },
      mqttTopicSensor: 'line9/temp',
      mqttTopicCmd: 'line9/fan',
      metaData: {
        chamberDescription: 'Desc',
        sensors: [
          {
            sensorName: 'Temp',
            sensorType: 'Temperature',
            feedKey: 'line9/temp',
            status: 'Active',
          },
        ],
        actuatorChannels: [
          {
            actuatorName: 'Fan',
            actuatorType: 'Fan',
            feedKey: 'line9/fan',
            status: 'Active',
          },
        ],
      },
      sensorChannels: [],
      actuatorChannels: [],
    });

    const created = await service.create({
      chamberName: 'Chamber 9',
      chamberDescription: 'Desc',
      zoneID: 7,
      sensors: [
        {
          sensorName: 'Temp',
          sensorType: 'Temperature',
          feedKey: 'line9/temp',
          status: 'Active',
        },
      ],
      actuatorChannels: [
        {
          actuatorName: 'Fan',
          actuatorType: 'Fan',
          feedKey: 'line9/fan',
          status: 'Active',
        },
      ],
    } as any);

    expect(prisma.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mqttTopicSensor: 'line9/temp',
          mqttTopicCmd: 'line9/fan',
        }),
      }),
    );
    expect(created).toMatchObject({ chamberID: 9 });
  });

  it('update uses existing sensors when dto omits sensors', async () => {
    const { service, prisma, mqttService } = createService();

    prisma.device.findUnique
      .mockResolvedValueOnce({
        metaData: {
          sensors: [
            {
              sensorName: 'Humidity',
              sensorType: 'Humidity',
              feedKey: 'line6/hum',
              status: 'Active',
            },
          ],
        },
        mqttTopicSensor: 'line6/hum',
      })
      .mockResolvedValueOnce({
        deviceID: 6,
        deviceName: 'Chamber 6',
        deviceStatus: 'Active',
        zoneID: 1,
        zone: { zoneName: 'Zone 1' },
        mqttTopicSensor: 'line6/hum',
        metaData: {
          sensors: [
            {
              sensorName: 'Humidity',
              sensorType: 'Humidity',
              feedKey: 'line6/hum',
              status: 'Active',
            },
          ],
        },
      });

    prisma.device.findMany.mockResolvedValue([]);
    prisma.device.update.mockResolvedValue({});

    const updated = await service.update(6, { chamberName: 'Updated' } as any);

    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deviceID: 6 },
        data: expect.objectContaining({
          mqttTopicSensor: 'line6/hum',
          deviceName: 'Updated',
        }),
      }),
    );
    expect(mqttService.subscribeToFeeds).toHaveBeenCalledWith(['line6/hum']);
    expect(updated).toMatchObject({ chamberID: 6 });
  });

  it('remove soft-deletes chamber and returns ok', async () => {
    const { service, prisma } = createService();

    prisma.device.findUnique.mockResolvedValue({
      deviceID: 8,
      deviceName: 'Chamber 8',
      deviceStatus: 'Active',
      zoneID: null,
      zone: null,
      mqttTopicSensor: null,
      metaData: null,
    });
    prisma.device.update.mockResolvedValue({});

    await expect(service.remove(8)).resolves.toEqual({ ok: true });
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { deviceID: 8 },
      data: { deviceStatus: 'Deleted' },
    });
  });

  it('throws when creating with duplicate feed keys in same chamber', async () => {
    const { service } = createService();

    await expect(
      service.create({
        chamberName: 'Dup Chamber',
        sensors: [
          {
            sensorName: 'S1',
            sensorType: 'Temperature',
            feedKey: 'dup/feed',
          },
          {
            sensorName: 'S2',
            sensorType: 'Humidity',
            feedKey: 'dup/feed',
          },
        ],
      } as any),
    ).rejects.toThrow('Feed key bị trùng trong cùng buồng');
  });
});

describe('ChambersController', () => {
  it('delegates crud operations to service', async () => {
    const service = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      remove: jest.fn().mockResolvedValue({ ok: true }),
    };

    const controller = new ChambersController(service as any);

    await controller.findAll();
    await controller.findOne(1);
    await controller.create({} as any);
    await controller.update(1, {} as any);
    await controller.remove(1);

    expect(service.findAll).toHaveBeenCalled();
    expect(service.findOne).toHaveBeenCalledWith(1);
    expect(service.create).toHaveBeenCalled();
    expect(service.update).toHaveBeenCalledWith(1, {});
    expect(service.remove).toHaveBeenCalledWith(1);
  });
});
