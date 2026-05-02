import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AnalyticsQuery = {
  from?: string;
  to?: string;
  zoneId?: number;
  period?: 'day' | 'week' | 'month' | 'year';
  status?: 'all' | 'success' | 'fail';
  page?: number;
  pageSize?: number;
};

type HourlyQuery = AnalyticsQuery & {
  metric?: string;
};

type BatchLike = {
  batchStatus: string | null;
  batchResult: string | null;
  startedAt: Date | null;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private startOfWeek(date: Date) {
    const value = new Date(date);
    const day = value.getUTCDay();
    const diff = (day + 6) % 7;
    value.setUTCDate(value.getUTCDate() - diff);
    value.setUTCHours(0, 0, 0, 0);
    return value;
  }

  private getPeriodKey(date: Date, period: 'day' | 'week' | 'month' | 'year') {
    if (period === 'day') {
      return date.toISOString().slice(0, 10);
    }

    if (period === 'week') {
      return this.startOfWeek(date).toISOString().slice(0, 10);
    }

    if (period === 'month') {
      return `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
    }

    return `${date.getUTCFullYear()}`;
  }

  private getPeriodLabel(
    key: string,
    period: 'day' | 'week' | 'month' | 'year',
  ) {
    if (period === 'day') return key;

    if (period === 'week') {
      const start = new Date(`${key}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      return `${String(start.getUTCDate()).padStart(2, '0')}/${String(
        start.getUTCMonth() + 1,
      ).padStart(
        2,
        '0',
      )} - ${String(end.getUTCDate()).padStart(2, '0')}/${String(
        end.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
    }

    if (period === 'month') {
      const [year, month] = key.split('-');
      return `${month}/${year}`;
    }

    return key;
  }

  private parseRange(from?: string, to?: string, useCurrentMonth = false) {
    if (from || to) {
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      const fromValid =
        fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
      const toValid = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;
      return { from: fromValid, to: toValid };
    }

    if (useCurrentMonth) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
        0,
        0,
        0,
        0,
      );
      return { from: start, to: end };
    }

    return { from: null, to: null };
  }

  private classifyBatch(row: BatchLike) {
    const status = (row.batchStatus ?? '').toLowerCase();
    const result = (row.batchResult ?? '').toLowerCase();

    const isSuccess =
      status === 'done' ||
      status === 'completed' ||
      result === 'success' ||
      result === 'completed' ||
      result.startsWith('completed') ||
      result.includes('success');

    const isFail =
      status === 'error' ||
      status === 'stopped' ||
      result.includes('fail') ||
      result.includes('threshold') ||
      result.includes('exceed');

    return {
      isSuccess,
      isFail,
      isRunning: status === 'running',
    };
  }

  private extractMetricValue(
    measurements: unknown,
    metric: 'temperature' | 'humidity',
  ) {
    if (!measurements || typeof measurements !== 'object') return null;

    const row = measurements as Record<string, unknown>;

    const direct = Number(row[metric]);
    if (Number.isFinite(direct)) return direct;

    const sensorType = String(row.sensorType ?? '').toLowerCase();
    if (sensorType.includes(metric)) {
      const v = Number(row.value);
      if (Number.isFinite(v)) return v;
    }

    const feed = String(row.feed ?? '').toLowerCase();
    const metricAliases =
      metric === 'temperature' ? ['temp', 'temperature'] : ['hum', 'humidity'];
    const hasMetricFeed = metricAliases.some((key) => feed.includes(key));
    if (hasMetricFeed) {
      const v = Number(row.value);
      if (Number.isFinite(v)) return v;
    }

    return null;
  }

  async getSummary(query: AnalyticsQuery) {
    const { from, to } = this.parseRange(query.from, query.to, true);

    const rows = await this.prisma.batch.findMany({
      where: {
        startedAt: {
          gte: from ?? undefined,
          lt: to ?? undefined,
        },
        device: query.zoneId
          ? {
              zoneID: query.zoneId,
            }
          : undefined,
      },
      select: {
        batchStatus: true,
        batchResult: true,
      },
    });

    const machineRows = await this.prisma.device.findMany({
      where: query.zoneId ? { zoneID: query.zoneId } : undefined,
      select: { deviceStatus: true },
    });

    let success = 0;
    let fail = 0;
    let running = 0;

    for (const row of rows) {
      const c = this.classifyBatch({ ...row, startedAt: null });
      if (c.isSuccess) success += 1;
      if (c.isFail) fail += 1;
      if (c.isRunning) running += 1;
    }

    const total = rows.length;
    const safeTotal = total || 1;

    const activeMachines = machineRows.filter(
      (m) => (m.deviceStatus ?? '').toLowerCase() === 'active',
    ).length;

    return {
      range: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      batches: {
        total,
        success,
        fail,
        running,
        successRate: Number(((success / safeTotal) * 100).toFixed(2)),
        failRate: Number(((fail / safeTotal) * 100).toFixed(2)),
      },
      machines: {
        total: machineRows.length,
        active: activeMachines,
        inactive: machineRows.length - activeMachines,
      },
    };
  }

  async getTrend(query: AnalyticsQuery) {
    const { from, to } = this.parseRange(query.from, query.to, true);
    const period =
      query.period === 'week' ||
      query.period === 'month' ||
      query.period === 'year'
        ? query.period
        : 'day';
    const statusFilter =
      query.status === 'success' || query.status === 'fail'
        ? query.status
        : 'all';
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 10)));

    const rows = await this.prisma.batch.findMany({
      where: {
        startedAt: {
          gte: from ?? undefined,
          lt: to ?? undefined,
        },
        device: query.zoneId
          ? {
              zoneID: query.zoneId,
            }
          : undefined,
      },
      select: {
        startedAt: true,
        batchStatus: true,
        batchResult: true,
      },
      orderBy: { startedAt: 'asc' },
    });

    const byDay = new Map<
      string,
      {
        key: string;
        date: string;
        total: number;
        success: number;
        fail: number;
        running: number;
      }
    >();

    for (const row of rows) {
      if (!row.startedAt) continue;
      const dayKey = this.getPeriodKey(row.startedAt, period);
      const current = byDay.get(dayKey) ?? {
        key: dayKey,
        date: this.getPeriodLabel(dayKey, period),
        total: 0,
        success: 0,
        fail: 0,
        running: 0,
      };

      const c = this.classifyBatch(row);
      current.total += 1;
      if (c.isSuccess) current.success += 1;
      if (c.isFail) current.fail += 1;
      if (c.isRunning) current.running += 1;

      byDay.set(dayKey, current);
    }

    const allPoints = Array.from(byDay.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({
        date: item.date,
        total: item.total,
        success: item.success,
        fail: item.fail,
        running: item.running,
        successRate:
          item.total > 0
            ? Number(((item.success / item.total) * 100).toFixed(2))
            : 0,
      }))
      .filter((point) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'success') return point.fail === 0;
        return point.fail > 0;
      });

    const total = allPoints.length;
    const start = (page - 1) * pageSize;
    const points = allPoints.slice(start, start + pageSize);

    return {
      range: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      period,
      status: statusFilter,
      points,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async getHourlyAvg(query: HourlyQuery) {
    const { from, to } = this.parseRange(query.from, query.to, false);
    const metric =
      (query.metric ?? 'temperature').toLowerCase() === 'humidity'
        ? 'humidity'
        : 'temperature';

    const rows = await this.prisma.sensorDataLog.findMany({
      where: {
        logTimestamp: {
          gte: from ?? undefined,
          lt: to ?? undefined,
        },
        deviceID: query.zoneId
          ? {
              in: (
                await this.prisma.device.findMany({
                  where: { zoneID: query.zoneId },
                  select: { deviceID: true },
                })
              ).map((d) => d.deviceID),
            }
          : undefined,
      },
      select: {
        logTimestamp: true,
        measurements: true,
      },
      orderBy: { logTimestamp: 'asc' },
      take: 5000,
    });

    const bucket = new Map<
      string,
      { hour: string; sum: number; count: number }
    >();

    for (const row of rows) {
      if (!row.logTimestamp) continue;
      const value = this.extractMetricValue(row.measurements, metric);
      if (!Number.isFinite(value)) continue;

      const hour = `${String(row.logTimestamp.getHours()).padStart(2, '0')}:00`;
      const current = bucket.get(hour) ?? { hour, sum: 0, count: 0 };
      current.sum += Number(value);
      current.count += 1;
      bucket.set(hour, current);
    }

    const points = Array.from(bucket.values())
      .map((item) => ({
        hour: item.hour,
        avg: item.count > 0 ? Number((item.sum / item.count).toFixed(2)) : 0,
        samples: item.count,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return {
      metric,
      range: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      points,
    };
  }

  async getMtbf(query: AnalyticsQuery) {
    const devices = await this.prisma.device.findMany({
      where: query.zoneId ? { zoneID: query.zoneId } : undefined,
      include: {
        alerts: {
          orderBy: { alertTime: 'desc' },
        },
      },
    });

    const result = devices.map((device) => {
      const allAlerts = device.alerts || [];
      const errorAlerts = allAlerts.filter(
        (a) =>
          (a.alertType ?? '').toLowerCase().includes('error') ||
          (a.alertType ?? '').toLowerCase().includes('fault') ||
          (a.alertType ?? '').toLowerCase().includes('fail'),
      );

      const numFailures = errorAlerts.length;
      const lastAlert = allAlerts[0]?.alertTime;

      let risk = 'Optimal';
      let riskColor = '#52c41a';
      let progress = 15;

      if (numFailures >= 5) {
        risk = 'High Risk';
        riskColor = '#ff4d4f';
        progress = Math.min(100, 70 + numFailures * 5);
      } else if (numFailures >= 2) {
        risk = 'Monitor';
        riskColor = '#faad14';
        progress = Math.min(100, 40 + numFailures * 10);
      } else if (numFailures === 1) {
        risk = 'Optimal';
        riskColor = '#52c41a';
        progress = 25;
      }

      let subtitle = 'Chưa từng hỏng hóc';
      if (lastAlert) {
        const days = Math.floor(
          (Date.now() - lastAlert.getTime()) / (1000 * 60 * 60 * 24),
        );
        subtitle = `Sự cố cuối: ${days} ngày trước`;
      }

      return {
        name: device.deviceName || `Buồng sấy ${device.deviceID}`,
        subtitle,
        risk,
        riskColor,
        progress,
        progressColor: riskColor,
      };
    });

    return result.sort((a, b) => b.progress - a.progress).slice(0, 5);
  }
}
