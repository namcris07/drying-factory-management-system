import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const createService = () => {
    const prisma = {
      batch: {
        findMany: jest.fn(),
      },
      device: {
        findMany: jest.fn(),
      },
      sensorDataLog: {
        findMany: jest.fn(),
      },
    };

    const service = new AnalyticsService(prisma as any);
    return { service, prisma };
  };

  it('getSummary returns aggregate batch and machine metrics', async () => {
    const { service, prisma } = createService();

    prisma.batch.findMany.mockResolvedValue([
      { batchStatus: 'Done', batchResult: null },
      { batchStatus: 'Running', batchResult: null },
      { batchStatus: 'Stopped', batchResult: 'failed by threshold' },
    ]);
    prisma.device.findMany.mockResolvedValue([
      { deviceStatus: 'Active' },
      { deviceStatus: 'Inactive' },
    ]);

    const result = await service.getSummary({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-02-01T00:00:00.000Z',
      zoneId: 2,
    });

    expect(prisma.batch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          device: { zoneID: 2 },
        }),
      }),
    );
    expect(result.batches).toMatchObject({
      total: 3,
      success: 1,
      fail: 1,
      running: 1,
    });
    expect(result.machines).toEqual({ total: 2, active: 1, inactive: 1 });
  });

  it('getTrend supports period/status filter and pagination', async () => {
    const { service, prisma } = createService();

    prisma.batch.findMany.mockResolvedValue([
      {
        startedAt: new Date('2026-01-05T10:00:00.000Z'),
        batchStatus: 'Done',
        batchResult: 'success',
      },
      {
        startedAt: new Date('2026-01-06T10:00:00.000Z'),
        batchStatus: 'Error',
        batchResult: 'failed',
      },
    ]);

    const result = await service.getTrend({
      period: 'week',
      status: 'fail',
      page: 1,
      pageSize: 1,
    });

    expect(result.period).toBe('week');
    expect(result.status).toBe('fail');
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.fail).toBeGreaterThan(0);
    expect(result.pagination).toMatchObject({ page: 1, pageSize: 1, total: 1 });
  });

  it('getHourlyAvg computes metric averages and zone filter', async () => {
    const { service, prisma } = createService();

    prisma.device.findMany.mockResolvedValue([{ deviceID: 10 }]);
    prisma.sensorDataLog.findMany.mockResolvedValue([
      {
        logTimestamp: new Date('2026-01-01T06:05:00.000Z'),
        measurements: { humidity: 60 },
      },
      {
        logTimestamp: new Date('2026-01-01T06:30:00.000Z'),
        measurements: { sensorType: 'humidity', value: 70 },
      },
      {
        logTimestamp: new Date('2026-01-01T07:00:00.000Z'),
        measurements: { feed: 'room-hum', value: 80 },
      },
      {
        logTimestamp: null,
        measurements: { humidity: 99 },
      },
    ]);

    const result = await service.getHourlyAvg({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-02T00:00:00.000Z',
      metric: 'humidity',
      zoneId: 9,
    });

    expect(prisma.device.findMany).toHaveBeenCalledWith({
      where: { zoneID: 9 },
      select: { deviceID: true },
    });
    expect(result.metric).toBe('humidity');
    expect(result.points).toHaveLength(2);
    expect(result.points.map((point) => point.avg)).toEqual([65, 80]);
    expect(result.points.map((point) => point.samples)).toEqual([2, 1]);
  });
});

describe('AnalyticsController', () => {
  it('parses query params and delegates to service', async () => {
    const service = {
      getSummary: jest.fn().mockResolvedValue({}),
      getTrend: jest.fn().mockResolvedValue({}),
      getHourlyAvg: jest.fn().mockResolvedValue({}),
    };
    const controller = new AnalyticsController(service as any);

    await controller.getSummary('2026-01-01', '2026-01-31', '2');
    await controller.getTrend(
      '2026-01-01',
      '2026-01-31',
      '3',
      'month',
      'all',
      '2',
      '20',
    );
    await controller.getHourlyAvg(
      '2026-01-01',
      '2026-01-31',
      '4',
      'temperature',
    );

    expect(service.getSummary).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-01-31',
      zoneId: 2,
    });
    expect(service.getTrend).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-01-31',
      zoneId: 3,
      period: 'month',
      status: 'all',
      page: 2,
      pageSize: 20,
    });
    expect(service.getHourlyAvg).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-01-31',
      zoneId: 4,
      metric: 'temperature',
    });
  });
});
