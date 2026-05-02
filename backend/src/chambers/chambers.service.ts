import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MqttService } from '../mqtt/mqtt.service';
import {
  ChamberActuatorDto,
  ChamberSensorDto,
  CreateChamberDto,
} from './dto/create-chamber.dto';

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
  actuatorChannels: {
    actuatorName: string;
    actuatorType: string;
    feedKey: string;
    status: string;
  }[];
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

  private normalizeActuators(input: ChamberActuatorDto[] | undefined): Array<{
    actuatorName: string;
    actuatorType: string;
    feedKey: string;
    status: string;
  }> {
    const rows = Array.isArray(input) ? input : [];
    const seen = new Set<string>();
    const normalized: Array<{
      actuatorName: string;
      actuatorType: string;
      feedKey: string;
      status: string;
    }> = [];

    for (const [index, row] of rows.entries()) {
      const feedKey = this.normalizeFeedKey(row.feedKey);
      if (!feedKey) continue;

      if (seen.has(feedKey)) {
        throw new Error(
          `Feed key actuator bị trùng trong cùng buồng tại vị trí ${index + 1}.`,
        );
      }
      seen.add(feedKey);

      normalized.push({
        actuatorName: String(
          row.actuatorName ?? row.actuatorType ?? `Actuator ${index + 1}`,
        ).trim(),
        actuatorType: String(row.actuatorType ?? 'Custom').trim(),
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
    actuatorChannels: Array<{
      actuatorName: string;
      actuatorType: string;
      feedKey: string;
      status: string;
    }>,
  ): Prisma.InputJsonValue {
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? (existing as Record<string, unknown>)
        : {};

    return {
      ...base,
      chamberDescription,
      sensors,
      actuatorChannels,
    } as Prisma.InputJsonValue;
  }

  private async assertNoFeedConflicts(
    sensors: ChamberSensor[],
    actuators: Array<{ feedKey: string }>,
    currentDeviceId?: number,
  ) {
    const requestedFeeds = [
      ...sensors.map((sensor) => this.normalizeFeedKey(sensor.feedKey)),
      ...actuators.map((actuator) => this.normalizeFeedKey(actuator.feedKey)),
    ];
    if (requestedFeeds.length === 0) return;

    const [rows, sensorChannels, actuatorChannels] = await Promise.all([
      this.prisma.device.findMany({
        select: {
          deviceID: true,
          mqttTopicSensor: true,
          mqttTopicCmd: true,
        },
      }),
      this.prisma.sensorChannel.findMany({
        select: { deviceID: true, feedKey: true },
      }),
      this.prisma.actuatorChannel.findMany({
        select: { deviceID: true, feedKey: true },
      }),
    ]);

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
      for (const feed of this.splitFeedText(row.mqttTopicCmd)) {
        const key = this.normalizeFeedKey(feed);
        if (!key) continue;
        if (!feedOwners.has(key)) {
          feedOwners.set(key, new Set<number>());
        }
        feedOwners.get(key)?.add(row.deviceID);
      }
    }

    for (const row of sensorChannels) {
      if (currentDeviceId && row.deviceID === currentDeviceId) continue;
      const key = this.normalizeFeedKey(row.feedKey);
      if (!key) continue;
      if (!feedOwners.has(key)) {
        feedOwners.set(key, new Set<number>());
      }
      feedOwners.get(key)?.add(row.deviceID ?? -1);
    }

    for (const row of actuatorChannels) {
      if (currentDeviceId && row.deviceID === currentDeviceId) continue;
      const key = this.normalizeFeedKey(row.feedKey);
      if (!key) continue;
      if (!feedOwners.has(key)) {
        feedOwners.set(key, new Set<number>());
      }
      feedOwners.get(key)?.add(row.deviceID ?? -1);
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
    mqttTopicCmd: string | null;
    metaData: Prisma.JsonValue | null;
    sensorChannels?: {
      sensorName: string | null;
      sensorType: string | null;
      feedKey: string;
      status: string | null;
    }[];
    actuatorChannels?: {
      actuatorName: string | null;
      actuatorType: string | null;
      feedKey: string;
      status: string | null;
    }[];
  }): ChamberResponse {
    const sensors =
      Array.isArray(device.sensorChannels) && device.sensorChannels.length > 0
        ? device.sensorChannels.map((sensor, index) => ({
            sensorName:
              sensor.sensorName?.trim() ||
              sensor.sensorType?.trim() ||
              `Sensor ${index + 1}`,
            sensorType: sensor.sensorType?.trim() || 'Custom',
            feedKey: this.normalizeFeedKey(sensor.feedKey),
            status: sensor.status?.trim() || 'Active',
          }))
        : this.extractSensorsFromDevice({
            mqttTopicSensor: device.mqttTopicSensor,
            metaData: device.metaData,
          });

    const actuatorChannels =
      Array.isArray(device.actuatorChannels) &&
      device.actuatorChannels.length > 0
        ? device.actuatorChannels.map((actuator, index) => ({
            actuatorName:
              actuator.actuatorName?.trim() ||
              actuator.actuatorType?.trim() ||
              `Actuator ${index + 1}`,
            actuatorType: actuator.actuatorType?.trim() || 'Custom',
            feedKey: this.normalizeFeedKey(actuator.feedKey),
            status: actuator.status?.trim() || 'Active',
          }))
        : this.splitFeedText(device.mqttTopicCmd).map((feedKey, index) => ({
            actuatorName: `Actuator ${index + 1}`,
            actuatorType: 'Custom',
            feedKey: this.normalizeFeedKey(feedKey),
            status: 'Active',
          }));

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
      actuatorChannels,
    };
  }

  private async syncDeviceChannels(
    deviceId: number,
    sensors: ChamberSensor[],
    actuators: Array<{
      actuatorName: string;
      actuatorType: string;
      feedKey: string;
      status: string;
    }>,
  ) {
    await this.prisma.sensorChannel.deleteMany({
      where: { deviceID: deviceId },
    });
    await this.prisma.actuatorChannel.deleteMany({
      where: { deviceID: deviceId },
    });

    if (sensors.length > 0) {
      await this.prisma.sensorChannel.createMany({
        data: sensors.map((sensor, index) => ({
          deviceID: deviceId,
          sensorName: sensor.sensorName,
          sensorType: sensor.sensorType,
          feedKey: sensor.feedKey,
          status: sensor.status,
          sortOrder: index + 1,
        })),
      });
    }

    if (actuators.length > 0) {
      await this.prisma.actuatorChannel.createMany({
        data: actuators.map((actuator, index) => ({
          deviceID: deviceId,
          actuatorName: actuator.actuatorName,
          actuatorType: actuator.actuatorType,
          feedKey: actuator.feedKey,
          status: actuator.status,
          sortOrder: index + 1,
        })),
      });
    }
  }

  findAll() {
    return this.prisma.device
      .findMany({
        where: {
          deviceStatus: { not: 'Deleted' },
        },
        include: {
          zone: { select: { zoneName: true } },
          sensorChannels: true,
          actuatorChannels: true,
        },
        orderBy: { deviceID: 'asc' },
      })
      .then((rows) => rows.map((row) => this.mapDeviceToChamber(row)));
  }

  async findOne(id: number) {
    const chamber = await this.prisma.device.findUnique({
      where: { deviceID: id },
      include: {
        zone: { select: { zoneName: true } },
        sensorChannels: true,
        actuatorChannels: true,
      },
    });

    if (!chamber || chamber.deviceStatus === 'Deleted') {
      throw new NotFoundException(`Chamber ${id} not found`);
    }

    return this.mapDeviceToChamber(chamber);
  }

  async create(dto: CreateChamberDto) {
    const sensors = this.normalizeSensors(dto.sensorChannels ?? dto.sensors);
    const actuators = this.normalizeActuators(dto.actuatorChannels);
    await this.assertNoFeedConflicts(sensors, actuators);

    const mqttTopicSensor = sensors.map((sensor) => sensor.feedKey).join(',');
    const mqttTopicCmd = actuators
      .map((actuator) => actuator.feedKey)
      .join(',');

    // Ensure the sequence is up to date before inserting to avoid UniqueConstraintViolation
    await this.prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"Devices"', 'DeviceID'),
        COALESCE((SELECT MAX("DeviceID") FROM "Devices"), 0) + 1,
        false
      );
    `);

    const created = await this.prisma.device.create({
      data: {
        deviceName: dto.chamberName,
        deviceStatus: dto.chamberStatus ?? 'Active',
        deviceType: 'DryingChamber',
        zoneID: dto.zoneID,
        mqttTopicSensor: mqttTopicSensor || null,
        mqttTopicCmd: mqttTopicCmd || null,
        metaData: this.buildMetaData(
          null,
          dto.chamberDescription,
          sensors,
          actuators,
        ),
      },
      select: { deviceID: true },
    });

    await this.syncDeviceChannels(created.deviceID, sensors, actuators);

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
        mqttTopicCmd: true,
        deviceStatus: true,
      },
    });
    if (!current || current.deviceStatus === 'Deleted') {
      throw new NotFoundException(`Chamber ${id} not found`);
    }

    const hasNewSensorPayload =
      dto.sensorChannels !== undefined || dto.sensors !== undefined;
    const hasNewActuatorPayload = dto.actuatorChannels !== undefined;

    const nextSensors = hasNewSensorPayload
      ? this.normalizeSensors(dto.sensorChannels ?? dto.sensors)
      : this.extractSensorsFromDevice(current);

    const nextActuators = hasNewActuatorPayload
      ? this.normalizeActuators(dto.actuatorChannels)
      : this.splitFeedText(current.mqttTopicCmd).map((feedKey, index) => ({
          actuatorName: `Actuator ${index + 1}`,
          actuatorType: 'Custom',
          feedKey: this.normalizeFeedKey(feedKey),
          status: 'Active',
        }));

    await this.assertNoFeedConflicts(nextSensors, nextActuators, id);

    const mqttTopicSensor = nextSensors
      .map((sensor) => sensor.feedKey)
      .join(',');
    const mqttTopicCmd = nextActuators
      .map((actuator) => actuator.feedKey)
      .join(',');
    await this.prisma.device.update({
      where: { deviceID: id },
      data: {
        deviceName: dto.chamberName,
        deviceStatus: dto.chamberStatus,
        zoneID: dto.zoneID,
        mqttTopicSensor,
        mqttTopicCmd,
        metaData: this.buildMetaData(
          current.metaData,
          dto.chamberDescription,
          nextSensors,
          nextActuators,
        ),
      },
    });

    await this.syncDeviceChannels(id, nextSensors, nextActuators);

    await this.mqttService.subscribeToFeeds(
      nextSensors.map((sensor) => sensor.feedKey),
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.device.update({
      where: { deviceID: id },
      data: { deviceStatus: 'Deleted' },
    });
    return { ok: true };
  }
}
