import { NotFoundException } from '@nestjs/common';
import { MqttService } from './mqtt.service';

describe('MqttService device state', () => {
  const createService = () => {
    const prisma = {
      device: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      sensorDataLog: {
        create: jest.fn(),
      },
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      systemConfigUpdate: {
        create: jest.fn(),
      },
      alert: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(async (ops: Array<Promise<unknown>>) =>
        Promise.all(ops),
      ),
    };

    const config = {
      get: jest.fn((key: string, defaultValue?: string) => defaultValue ?? ''),
    };

    const modeControl = {
      getCurrentMode: jest.fn().mockResolvedValue('manual'),
    };

    const service = new MqttService(
      config as any,
      prisma as any,
      modeControl as any,
    );
    return { service, prisma };
  };

  it('returns configured feeds with current value from cache', async () => {
    const { service, prisma } = createService();
    prisma.device.findUnique.mockResolvedValue({
      deviceID: 7,
      mqttTopicSensor: 'm-a1/temperature,m-a1/humidity',
      metaData: { sensorFeeds: ['m-a1/custom-vibration'] },
    });

    (service as any).feedState.set('m-a1/temperature', {
      feed: 'm-a1/temperature',
      topic: 'user/feeds/m-a1/temperature',
      value: 65.2,
      source: 'adafruit',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });

    const result = await service.getDeviceFeedState(7);

    expect(result.deviceId).toBe(7);
    expect(result.feeds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feed: 'm-a1/custom-vibration',
          sensorType: 'custom',
          value: undefined,
        }),
        expect.objectContaining({
          feed: 'm-a1/temperature',
          sensorType: 'temperature',
          value: 65.2,
        }),
      ]),
    );
  });

  it('throws not found when device does not exist', async () => {
    const { service, prisma } = createService();
    prisma.device.findUnique.mockResolvedValue(null);

    await expect(service.getDeviceFeedState(404)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applies dynamic humidity rule to pump feeds', async () => {
    const { service, prisma } = createService();

    prisma.device.findMany.mockImplementation(async ({ select }: any) => {
      if (select?.mqttTopicCmd) {
        return [{ mqttTopicCmd: 'drytech.m-a1-pump', actuatorChannels: [] }];
      }

      if (select?.mqttTopicSensor) {
        return [{ mqttTopicSensor: 'drytech.m-a1-humidity', metaData: null }];
      }

      return [];
    });
    prisma.systemConfig.findMany.mockResolvedValue([]);

    (service as any).getDynamicFanRules = jest.fn().mockResolvedValue([
      {
        id: 'RMQ7KFID0',
        enabled: true,
        sensorFeed: 'drytech.m-a1-humidity',
        comparator: 'lte',
        threshold: 76,
        fanFeed: 'drytech.m-a1-pump',
        fanLevelOn: 100,
        fanLevelOff: 0,
        priority: 100,
        cooldownMs: 5000,
      },
    ]);
    (service as any).getDynamicFanGroups = jest.fn().mockResolvedValue([]);
    (service as any).getDynamicFanConflictConfig = jest.fn().mockResolvedValue({
      defaultCooldownMs: 5000,
      allowEqualPriorityTakeover: false,
    });

    await (service as any).evaluateDynamicFanRules('drytech.m-a1-humidity', 76);

    expect(prisma.sensorDataLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          measurements: expect.objectContaining({
            direction: 'outgoing',
            feed: 'drytech.m-a1-pump',
            value: 1,
          }),
        }),
      }),
    );
    expect((service as any).feedState.get('drytech.m-a1-pump')).toEqual(
      expect.objectContaining({ value: 1, source: 'server-command' }),
    );
  });

  it('turns off a previously active group rule when one condition fails', async () => {
    const { service, prisma } = createService();

    prisma.device.findMany.mockImplementation(async ({ select }: any) => {
      if (select?.mqttTopicCmd) {
        return [{ mqttTopicCmd: 'drytech.m-a1-pump', actuatorChannels: [] }];
      }

      if (select?.mqttTopicSensor) {
        return [
          {
            mqttTopicSensor: 'drytech.m-a1-humidity,drytech.m-a1-temp',
            metaData: null,
          },
        ];
      }

      return [];
    });
    prisma.systemConfig.findMany.mockResolvedValue([]);

    (service as any).feedState.set('drytech.m-a1-pump', {
      feed: 'drytech.m-a1-pump',
      topic: '/feeds/drytech.m-a1-pump',
      value: 1,
      source: 'server-command',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
    (service as any).feedState.set('drytech.m-a1-temp', {
      feed: 'drytech.m-a1-temp',
      topic: '/feeds/drytech.m-a1-temp',
      value: 55,
      source: 'adafruit',
      updatedAt: '2026-01-01T10:00:00.000Z',
    });
    (service as any).fanRuleResolutionState.set('drytechma1pump', {
      ruleId: 'GROUP-1',
      priority: 100,
      value: 1,
      appliedAt: Date.now() - 10000,
    });

    (service as any).getDynamicFanRules = jest.fn().mockResolvedValue([]);
    (service as any).getDynamicFanGroups = jest.fn().mockResolvedValue([
      {
        id: 'GROUP-1',
        enabled: true,
        operator: 'AND',
        conditions: [
          {
            sensorFeed: 'drytech.m-a1-humidity',
            comparator: 'lte',
            threshold: 76,
          },
          {
            sensorFeed: 'drytech.m-a1-temp',
            comparator: 'lte',
            threshold: 60,
          },
        ],
        outputs: [
          {
            fanFeed: 'drytech.m-a1-pump',
            fanLevelOn: 100,
            fanLevelOff: 0,
          },
        ],
        priority: 100,
        cooldownMs: 5000,
      },
    ]);
    (service as any).getDynamicFanConflictConfig = jest.fn().mockResolvedValue({
      defaultCooldownMs: 5000,
      allowEqualPriorityTakeover: false,
    });

    await (service as any).evaluateDynamicFanRules('drytech.m-a1-humidity', 80);

    expect(prisma.sensorDataLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          measurements: expect.objectContaining({
            direction: 'outgoing',
            feed: 'drytech.m-a1-pump',
            value: 0,
          }),
        }),
      }),
    );
    expect((service as any).feedState.get('drytech.m-a1-pump')).toEqual(
      expect.objectContaining({ value: 0, source: 'server-command' }),
    );
  });
});
