import { NotFoundException } from '@nestjs/common';
import { MqttService } from './mqtt.service';

describe('MqttService device state', () => {
  const createService = () => {
    const prisma = {
      device: {
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
});
