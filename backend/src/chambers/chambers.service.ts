import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import { ChamberSensorDto, CreateChamberDto } from './dto/create-chamber.dto';

type ChamberSensor = {
  sensorName: string;
  sensorType: string;
  feedKey: string;
  status: string;
};

type ChamberResponse = {
  chamberID: number;
  chamberName: string | null;
  chamberDescription: string | null;
  chamberStatus: string | null;
  zoneID: number | null;
  zoneName: string | null;
  sensors: ChamberSensor[];
};

@Injectable()
export class ChambersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  private splitFeedText(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeFeedKey(raw: string | null | undefined): string {
    const text = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!text) return '';

    const marker = '/feeds/';
    const markerIndex = text.indexOf(marker);
    if (markerIndex >= 0) {
      return text.slice(markerIndex + marker.length).trim();
    }

    return text;
  }

  private normalizeSensors(
    input: ChamberSensorDto[] | undefined,
  ): ChamberSensor[] {
    const rows = Array.isArray(input) ? input : [];
    const seen = new Set<string>();
    const normalized: ChamberSensor[] = [];

    for (const [index, row] of rows.entries()) {
      const feedKey = this.normalizeFeedKey(row.feedKey);
      if (!feedKey) continue;

      if (seen.has(feedKey)) {
        throw new Error(
          `Feed key bị trùng trong cùng buồng tại vị trí ${index + 1}.`,
        );
      }
      seen.add(feedKey);

      normalized.push({
        sensorName: String(
          row.sensorName ?? row.sensorType ?? `Sensor ${index + 1}`,
        ).trim(),
        sensorType: String(row.sensorType ?? 'Custom').trim(),
        feedKey,
        status: String(row.status ?? 'Active').trim() || 'Active',
      });
    }

    return normalized;
  }

  private extractSensorsFromDevice(device: {
    mqttTopicSensor: string | null;
    metaData: Prisma.JsonValue | null;
  }): ChamberSensor[] {
    const meta = device.metaData;

    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const sensorsRaw = (meta as { sensors?: unknown }).sensors;
      if (Array.isArray(sensorsRaw)) {
        const parsed = sensorsRaw
          .map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item))
              return null;
            const row = item as Record<string, unknown>;
            const feedKey = this.normalizeFeedKey(String(row.feedKey ?? ''));
            if (!feedKey) return null;

            return {
              sensorName: String(
                row.sensorName ?? row.sensorType ?? `Sensor ${index + 1}`,
              ).trim(),
              sensorType: String(row.sensorType ?? 'Custom').trim(),
              feedKey,
              status: String(row.status ?? 'Active').trim() || 'Active',
            } as ChamberSensor;
          })
          .filter((row): row is ChamberSensor => Boolean(row));

        if (parsed.length > 0) {
          return parsed;
        }
      }
    }

    return this.splitFeedText(device.mqttTopicSensor).map((feedKey, index) => ({
      sensorName: `Sensor ${index + 1}`,
      sensorType: 'Custom',
      feedKey: this.normalizeFeedKey(feedKey),
      status: 'Active',
    }));
  }

  private buildMetaData(
    existing: Prisma.JsonValue | null,
    chamberDescription: string | undefined,
    sensors: ChamberSensor[],
  ): Prisma.InputJsonValue {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {};

    return {
      ...base,
      chamberDescription,
      sensors,
    } as Prisma.InputJsonValue;
  }

  private async assertNoFeedConflicts(
    sensors: ChamberSensor[],
    currentDeviceId?: number,
  ) {
    const requestedFeeds = sensors.map((sensor) =>
      this.normalizeFeedKey(sensor.feedKey),
    );
    if (requestedFeeds.length === 0) return;

    const rows = await this.prisma.device.findMany({
      select: {
        deviceID: true,
        mqttTopicSensor: true,
      },
    });

    const feedOwners = new Map<string, Set<number>>();
    for (const row of rows) {
      if (currentDeviceId && row.deviceID === currentDeviceId) continue;
      for (const feed of this.splitFeedText(row.mqttTopicSensor)) {
        const key = this.normalizeFeedKey(feed);
        if (!key) continue;
        if (!feedOwners.has(key)) {
          feedOwners.set(key, new Set<number>());
        }
        feedOwners.get(key)?.add(row.deviceID);
      }
    }

    const conflictDetails = requestedFeeds
      .filter((feed) => feedOwners.has(feed))
      .map((feed) => ({
        feed,
        deviceIDs: Array.from(feedOwners.get(feed) ?? []),
      }));

    if (conflictDetails.length > 0) {
      const err = new Error('Feed key đã được gán cho buồng khác.');
      (err as Error & { conflicts?: unknown }).conflicts = conflictDetails;
      throw err;
    }
  }

  private mapDeviceToChamber(device: {
    deviceID: number;
    deviceName: string | null;
    deviceStatus: string | null;
    zoneID: number | null;
    zone: { zoneName: string | null } | null;
    mqttTopicSensor: string | null;
    metaData: Prisma.JsonValue | null;
  }): ChamberResponse {
    const sensors = this.extractSensorsFromDevice({
      mqttTopicSensor: device.mqttTopicSensor,
      metaData: device.metaData,
    });

    const description =
      device.metaData &&
      typeof device.metaData === 'object' &&
      !Array.isArray(device.metaData)
        ? String(
            ((device.metaData as Record<string, unknown>).chamberDescription as
              | string
              | undefined) ?? '',
          ).trim() || null
        : null;

    return {
      chamberID: device.deviceID,
      chamberName: device.deviceName,
      chamberDescription: description,
      chamberStatus: device.deviceStatus,
      zoneID: device.zoneID,
      zoneName: device.zone?.zoneName ?? null,
      sensors,
    };
  }

  findAll() {
    return this.prisma.device
      .findMany({
        include: { zone: { select: { zoneName: true } } },
        orderBy: { deviceID: 'asc' },
      })
      .then((rows) => rows.map((row) => this.mapDeviceToChamber(row)));
  }

  async findOne(id: number) {
    const chamber = await this.prisma.device.findUnique({
      where: { deviceID: id },
      include: { zone: { select: { zoneName: true } } },
    });

    if (!chamber) {
      throw new NotFoundException(`Chamber ${id} not found`);
    }

    return this.mapDeviceToChamber(chamber);
  }

  async create(dto: CreateChamberDto) {
    const sensors = this.normalizeSensors(dto.sensors);
    await this.assertNoFeedConflicts(sensors);

    const mqttTopicSensor = sensors.map((sensor) => sensor.feedKey).join(',');
    const created = await this.prisma.device.create({
      data: {
        deviceName: dto.chamberName,
        deviceStatus: dto.chamberStatus ?? 'Active',
        deviceType: 'DryingChamber',
        zoneID: dto.zoneID,
        mqttTopicSensor: mqttTopicSensor || null,
        mqttTopicCmd: null,
        metaData: this.buildMetaData(null, dto.chamberDescription, sensors),
      },
      select: { deviceID: true },
    });

    await this.prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"Devices"', 'DeviceID'),
        COALESCE((SELECT MAX("DeviceID") FROM "Devices"), 0) + 1,
        false
      );
    `);

    await this.mqttService.subscribeToFeeds(
      sensors.map((sensor) => sensor.feedKey),
    );

    return this.findOne(created.deviceID);
  }

  async update(id: number, dto: Partial<CreateChamberDto>) {
    const current = await this.prisma.device.findUnique({
      where: { deviceID: id },
      select: {
        metaData: true,
        mqttTopicSensor: true,
      },
    });
    if (!current) {
      throw new NotFoundException(`Chamber ${id} not found`);
    }

    const nextSensors =
      dto.sensors !== undefined
        ? this.normalizeSensors(dto.sensors)
        : this.extractSensorsFromDevice(current);

    await this.assertNoFeedConflicts(nextSensors, id);

    const mqttTopicSensor = nextSensors
      .map((sensor) => sensor.feedKey)
      .join(',');
    await this.prisma.device.update({
      where: { deviceID: id },
      data: {
        deviceName: dto.chamberName,
        deviceStatus: dto.chamberStatus,
        zoneID: dto.zoneID,
        mqttTopicSensor,
        metaData: this.buildMetaData(
          current.metaData,
          dto.chamberDescription,
          nextSensors,
        ),
      },
    });

    await this.mqttService.subscribeToFeeds(
      nextSensors.map((sensor) => sensor.feedKey),
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.device.delete({ where: { deviceID: id } });
    return { ok: true };
  }
}
