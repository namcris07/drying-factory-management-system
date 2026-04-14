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
      $executeRawUnsafe: jest.fn(),
    };

    const mqttService = {
      subscribeToFeeds: jest.fn(),
    };

    const service = new DevicesService(prisma as any, mqttService as any);
    return { service, prisma, mqttService };
  };

  it('findAll includes normalized sensorFeeds from metadata and text topic', async () => {
    const { service, prisma } = createService();

    prisma.device.findMany.mockResolvedValue([
      {
        deviceID: 1,
        deviceName: 'May A1',
        mqttTopicSensor: 'm-a1/temperature,m-a1/humidity',
        metaData: { sensorFeeds: ['m-a1/vibration'] },
        zone: null,
      },
    ]);

    const result = await service.findAll();

    expect(result[0]).toMatchObject({
      deviceID: 1,
      sensorFeeds: ['m-a1/vibration', 'm-a1/temperature', 'm-a1/humidity'],
    });
  });

  it('create persists merged sensorFeeds to metadata and refreshes mqtt subscriptions', async () => {
    const { service, prisma, mqttService } = createService();

    prisma.device.create.mockResolvedValue({
      deviceID: 2,
      deviceName: 'May B2',
      mqttTopicSensor: 'm-b2/temperature,m-b2/humidity',
      metaData: { sensorFeeds: ['m-b2/temperature', 'm-b2/humidity'] },
      zone: null,
    });

    prisma.device.findUnique.mockResolvedValue({
      deviceID: 2,
      deviceName: 'May B2',
      mqttTopicSensor: 'm-b2/temperature,m-b2/humidity',
      metaData: { sensorFeeds: ['m-b2/temperature', 'm-b2/humidity'] },
      zone: null,
    });

    prisma.device.findMany.mockResolvedValue([
      {
        mqttTopicSensor: 'm-b2/temperature,m-b2/humidity',
        metaData: { sensorFeeds: ['m-b2/temperature', 'm-b2/humidity'] },
      },
    ]);

    const created = await service.create({
      deviceName: 'May B2',
      sensorFeeds: ['m-b2/temperature', 'm-b2/humidity'],
    } as any);

    expect(prisma.device.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mqttTopicSensor: 'm-b2/temperature,m-b2/humidity',
          metaData: expect.objectContaining({
            sensorFeeds: ['m-b2/temperature', 'm-b2/humidity'],
          }),
        }),
      }),
    );
    expect(mqttService.subscribeToFeeds).toHaveBeenCalledWith([
      'm-b2/temperature',
      'm-b2/humidity',
    ]);
    expect(created).toHaveProperty('sensorFeeds');
  });
});
