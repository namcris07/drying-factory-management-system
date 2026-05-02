import { DevicesService } from './devices.service';

describe('DevicesService sensorFeeds response', () => {
  const createService = () => {
    const prisma = {
      device: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      zone: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      sensorChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      actuatorChannel: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      $executeRawUnsafe: jest.fn(),
    };

    const mqttService = {
      subscribeToFeeds: jest.fn(),
    };

    const service = new DevicesService(prisma as any, mqttService as any);
    return { service, prisma, mqttService };
  };

  it('findAll returns single normalized sensor feed from topic', async () => {
    const { service, prisma } = createService();

    prisma.device.findMany.mockResolvedValue([
      {
        deviceID: 1,
        deviceName: 'May A1',
        mqttTopicSensor: '  m-a1/temperature  ',
        metaData: { sensorFeeds: ['m-a1/vibration'] },
        zone: null,
      },
    ]);

    const result = await service.findAll();

    expect(result[0]).toMatchObject({
      deviceID: 1,
      sensorFeeds: ['m-a1/temperature'],
    });
  });

  it('create persists feed key to metadata and refreshes mqtt subscriptions', async () => {
    const { service, prisma, mqttService } = createService();

    prisma.device.create.mockResolvedValue({
      deviceID: 2,
      deviceName: 'May B2',
      mqttTopicSensor: 'm-b2/temperature',
      metaData: { feedKey: 'm-b2/temperature' },
      zone: null,
    });

    prisma.device.findUnique.mockResolvedValue({
      deviceID: 2,
      deviceName: 'May B2',
      mqttTopicSensor: 'm-b2/temperature',
      metaData: { feedKey: 'm-b2/temperature' },
      zone: null,
      sensorChannels: [],
      actuatorChannels: [],
    });

    // First call: from findOne -> attachZonesByZoneId (zone.findMany)
    // refreshMqttSubscriptionsFromDevices calls device.findMany with sensorChannels
    prisma.device.findMany.mockResolvedValue([
      {
        mqttTopicSensor: 'm-b2/temperature',
        metaData: { feedKey: 'm-b2/temperature' },
        sensorChannels: [],
      },
    ]);

    const created = await service.create({
      deviceName: 'May B2',
      mqttTopicSensor: 'm-b2/temperature',
    } as any);

    expect(prisma.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mqttTopicSensor: 'm-b2/temperature',
          metaData: expect.objectContaining({
            feedKey: 'm-b2/temperature',
          }),
        }),
      }),
    );
    expect(mqttService.subscribeToFeeds).toHaveBeenCalledWith([
      'm-b2/temperature',
    ]);
    expect(created).toHaveProperty('sensorFeeds');
  });
});
