import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private prisma: PrismaService,
    private readonly mqttService: MqttService,
  ) {}

  private splitFeedText(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private pickSingleFeed(raw: string | null | undefined): string {
    const normalized = this.splitFeedText(raw)
      .map((feed) => this.normalizeFeedKey(feed))
      .filter(Boolean);
    return normalized[0] ?? '';
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

  private mapDeviceResponse<
    T extends {
      mqttTopicSensor: string | null;
      metaData: Prisma.JsonValue | null;
      sensorChannels?: { feedKey: string }[];
    },
  >(device: T): T & { sensorFeeds: string[] } {
    // Lấy feeds từ SensorChannels nếu có, fallback về mqttTopicSensor
    const channelFeeds =
      device.sensorChannels && device.sensorChannels.length > 0
        ? device.sensorChannels.map((ch) => ch.feedKey)
        : [];

    const legacyFeed = this.pickSingleFeed(device.mqttTopicSensor);
    const allFeeds =
      channelFeeds.length > 0 ? channelFeeds : legacyFeed ? [legacyFeed] : [];

    return {
      ...device,
      sensorFeeds: allFeeds,
    };
  }

  private normalizeMetaData(
    existing: Prisma.JsonValue | null | undefined,
    next: Partial<CreateDeviceDto>,
    feedKey: string,
  ): Prisma.InputJsonValue {
    const base =
      next.metaData !== undefined
        ? next.metaData
        : existing && typeof existing === 'object' && !Array.isArray(existing)
          ? (existing as Record<string, unknown>)
          : {};

    return {
      ...base,
      feedKey,
    } as Prisma.InputJsonValue;
  }

  /**
   * Lấy tất cả sensor feed keys từ SensorChannels và mqttTopicSensor để subscribe MQTT.
   * Đảm bảo backward compat: device cũ chưa có SensorChannels vẫn dùng mqttTopicSensor.
   */
  private async refreshMqttSubscriptionsFromDevices() {
    const rows = await this.prisma.device.findMany({
      select: {
        mqttTopicSensor: true,
        sensorChannels: { select: { feedKey: true } },
      },
    });

    const feeds = new Set<string>();

    for (const row of rows) {
      // Ưu tiên SensorChannels
      if (row.sensorChannels && row.sensorChannels.length > 0) {
        for (const ch of row.sensorChannels) {
          if (ch.feedKey) feeds.add(ch.feedKey);
        }
      } else {
        // Fallback: dùng mqttTopicSensor
        const feed = this.pickSingleFeed(row.mqttTopicSensor);
        if (feed) feeds.add(feed);
      }
    }

    this.mqttService.subscribeToFeeds(Array.from(feeds));
  }

  private async syncDeviceIdSequence() {
    await this.prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"Devices"', 'DeviceID'),
        COALESCE((SELECT MAX("DeviceID") FROM "Devices"), 0) + 1,
        false
      );
    `);
  }

  private isDevicePrimaryKeyConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const maybeError = error as {
      code?: string;
      meta?: {
        target?: unknown;
        driverAdapterError?: {
          cause?: { constraint?: { fields?: string[] } };
        };
      };
    };

    if (maybeError.code !== 'P2002') return false;

    const target = maybeError.meta?.target;
    if (
      Array.isArray(target) &&
      target.some((t) => String(t).includes('DeviceID'))
    ) {
      return true;
    }

    const fields =
      maybeError.meta?.driverAdapterError?.cause?.constraint?.fields ?? [];
    return fields.some((field) => String(field).includes('DeviceID'));
  }

  private async attachZonesByZoneId<
    T extends {
      zoneID?: number | null;
    },
  >(
    rows: T[],
  ): Promise<
    Array<T & { zone: { zoneID: number; zoneName: string | null } | null }>
  > {
    const zoneIds = Array.from(
      new Set(
        rows
          .map((row) => row.zoneID)
          .filter((zoneID): zoneID is number => typeof zoneID === 'number'),
      ),
    );

    if (zoneIds.length === 0) {
      return rows.map((row) => ({ ...row, zone: null }));
    }

    const zones = await this.prisma.zone.findMany({
      where: { zoneID: { in: zoneIds } },
      select: { zoneID: true, zoneName: true },
    });

    const zoneMap = new Map(zones.map((zone) => [zone.zoneID, zone]));

    return rows.map((row) => ({
      ...row,
      zone:
        typeof row.zoneID === 'number'
          ? (zoneMap.get(row.zoneID) ?? null)
          : null,
    }));
  }

  /**
   * Include đầy đủ channels khi query device.
   */
  private deviceInclude() {
    return {
      sensorChannels: {
        orderBy: { sortOrder: 'asc' as const },
      },
      actuatorChannels: {
        orderBy: { sortOrder: 'asc' as const },
      },
    };
  }

  findAll() {
    return this.prisma.device
      .findMany({
        orderBy: { deviceID: 'asc' },
        include: this.deviceInclude(),
      })
      .then((rows) => this.attachZonesByZoneId(rows))
      .then((rows) => rows.map((row) => this.mapDeviceResponse(row)));
  }

  async findOne(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { deviceID: id },
      include: this.deviceInclude(),
    });
    if (!device) throw new NotFoundException(`Device ${id} not found`);

    const [withZone] = await this.attachZonesByZoneId([device]);
    return this.mapDeviceResponse(withZone);
  }

  /**
   * Upsert SensorChannels cho device.
   * Chiến lược: xóa channels cũ của device rồi tạo lại – đơn giản và tránh conflict feedKey.
   * Ghi chú: chỉ xóa channels thuộc deviceID này, không ảnh hưởng device khác.
   */
  private async upsertSensorChannels(
    deviceId: number,
    channels: CreateDeviceDto['sensorChannels'],
  ) {
    if (!Array.isArray(channels) || channels.length === 0) return;

    // Lấy feedKeys hiện tại của device này
    const existing = await this.prisma.sensorChannel.findMany({
      where: { deviceID: deviceId },
      select: { feedKey: true },
    });
    const existingKeys = new Set(existing.map((ch) => ch.feedKey));

    // FeedKeys mới
    const newKeys = new Set(channels.map((ch) => ch.feedKey));

    // Xóa channels không còn trong danh sách mới
    const toDelete = Array.from(existingKeys).filter(
      (key) => !newKeys.has(key),
    );
    if (toDelete.length > 0) {
      await this.prisma.sensorChannel.deleteMany({
        where: { deviceID: deviceId, feedKey: { in: toDelete } },
      });
    }

    // Upsert từng channel
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const existingOwner = await this.prisma.sensorChannel.findUnique({
        where: { feedKey: ch.feedKey },
        select: { deviceID: true },
      });
      if (existingOwner?.deviceID && existingOwner.deviceID !== deviceId) {
        throw new BadRequestException({
          message: 'Feed key đã được gán cho thiết bị khác.',
          conflicts: [
            { feedKey: ch.feedKey, deviceID: existingOwner.deviceID },
          ],
        });
      }

      await this.prisma.sensorChannel.upsert({
        where: { feedKey: ch.feedKey },
        create: {
          deviceID: deviceId,
          sensorName: ch.sensorName ?? null,
          sensorType: ch.sensorType ?? null,
          feedKey: ch.feedKey,
          status: ch.status ?? 'Active',
          unit: ch.unit ?? null,
          sortOrder: ch.sortOrder ?? i + 1,
        },
        update: {
          deviceID: deviceId,
          sensorName: ch.sensorName ?? null,
          sensorType: ch.sensorType ?? null,
          status: ch.status ?? 'Active',
          unit: ch.unit ?? null,
          sortOrder: ch.sortOrder ?? i + 1,
        },
      });
    }
  }

  /**
   * Upsert ActuatorChannels cho device.
   */
  private async upsertActuatorChannels(
    deviceId: number,
    channels: CreateDeviceDto['actuatorChannels'],
  ) {
    if (!Array.isArray(channels) || channels.length === 0) return;

    const existing = await this.prisma.actuatorChannel.findMany({
      where: { deviceID: deviceId },
      select: { feedKey: true },
    });
    const existingKeys = new Set(existing.map((ch) => ch.feedKey));

    const newKeys = new Set(channels.map((ch) => ch.feedKey));

    const toDelete = Array.from(existingKeys).filter(
      (key) => !newKeys.has(key),
    );
    if (toDelete.length > 0) {
      await this.prisma.actuatorChannel.deleteMany({
        where: { deviceID: deviceId, feedKey: { in: toDelete } },
      });
    }

    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const existingOwner = await this.prisma.actuatorChannel.findUnique({
        where: { feedKey: ch.feedKey },
        select: { deviceID: true },
      });
      if (existingOwner?.deviceID && existingOwner.deviceID !== deviceId) {
        throw new BadRequestException({
          message: 'Feed key đã được gán cho thiết bị khác.',
          conflicts: [
            { feedKey: ch.feedKey, deviceID: existingOwner.deviceID },
          ],
        });
      }

      await this.prisma.actuatorChannel.upsert({
        where: { feedKey: ch.feedKey },
        create: {
          deviceID: deviceId,
          actuatorName: ch.actuatorName ?? null,
          actuatorType: ch.actuatorType ?? null,
          feedKey: ch.feedKey,
          status: ch.status ?? 'Active',
          controlMode: ch.controlMode ?? null,
          onValue: ch.onValue ?? null,
          offValue: ch.offValue ?? null,
          sortOrder: ch.sortOrder ?? i + 1,
        },
        update: {
          deviceID: deviceId,
          actuatorName: ch.actuatorName ?? null,
          actuatorType: ch.actuatorType ?? null,
          status: ch.status ?? 'Active',
          controlMode: ch.controlMode ?? null,
          onValue: ch.onValue ?? null,
          offValue: ch.offValue ?? null,
          sortOrder: ch.sortOrder ?? i + 1,
        },
      });
    }
  }

  async create(dto: CreateDeviceDto) {
    // Với thiết kế channel, mqttTopicSensor là optional (backward compat).
    // Nếu có sensorChannels, dùng feedKey đầu tiên làm mqttTopicSensor để backward compat.
    const firstSensorFeedKey =
      dto.sensorChannels && dto.sensorChannels.length > 0
        ? this.normalizeFeedKey(dto.sensorChannels[0].feedKey)
        : dto.mqttTopicSensor
          ? this.normalizeFeedKey(dto.mqttTopicSensor)
          : null;

    const firstActuatorFeedKey =
      dto.actuatorChannels && dto.actuatorChannels.length > 0
        ? this.normalizeFeedKey(dto.actuatorChannels[0].feedKey)
        : dto.mqttTopicCmd
          ? this.normalizeFeedKey(dto.mqttTopicCmd)
          : null;

    const payload = {
      deviceName: dto.deviceName,
      deviceStatus: dto.deviceStatus,
      deviceType: dto.deviceType,
      mqttTopicSensor: firstSensorFeedKey || null,
      mqttTopicCmd: firstActuatorFeedKey || null,
      zoneID: dto.zoneID,
      organizationID: dto.organizationID,
      factoryID: dto.factoryID,
      siteID: dto.siteID,
      metaData: {
        feedKey: firstSensorFeedKey ?? '',
      } as Prisma.InputJsonValue,
    };

    let created;
    try {
      created = await this.prisma.device.create({ data: payload });
    } catch (error) {
      if (!this.isDevicePrimaryKeyConflict(error)) {
        throw error;
      }

      await this.syncDeviceIdSequence();
      created = await this.prisma.device.create({ data: payload });
    }

    // Lưu channels
    if (dto.sensorChannels && dto.sensorChannels.length > 0) {
      await this.upsertSensorChannels(created.deviceID, dto.sensorChannels);
    }
    if (dto.actuatorChannels && dto.actuatorChannels.length > 0) {
      await this.upsertActuatorChannels(created.deviceID, dto.actuatorChannels);
    }

    await this.refreshMqttSubscriptionsFromDevices();
    return this.findOne(created.deviceID);
  }

  async validateFeedConflicts(
    dto: {
      mqttTopicSensor?: string;
      mqttTopicCmd?: string;
      sensorChannels?: { feedKey: string }[];
      actuatorChannels?: { feedKey: string }[];
    },
    currentDeviceId?: number,
  ) {
    // Validation cơ bản: kiểm tra feedKey có bị trùng với channel của thiết bị khác không
    const legacySensorFeeds = this.splitFeedText(dto.mqttTopicSensor)
      .map((feed) => this.normalizeFeedKey(feed))
      .filter(Boolean);
    const legacyCommandFeeds = this.splitFeedText(dto.mqttTopicCmd)
      .map((feed) => this.normalizeFeedKey(feed))
      .filter(Boolean);

    const feedsToCheck = [
      ...legacySensorFeeds,
      ...legacyCommandFeeds,
      ...(dto.sensorChannels ?? []).map((ch) => ch.feedKey),
      ...(dto.actuatorChannels ?? []).map((ch) => ch.feedKey),
    ].filter(Boolean);

    if (feedsToCheck.length === 0) return { ok: true };

    const conflictSensor = await this.prisma.sensorChannel.findMany({
      where: {
        feedKey: { in: feedsToCheck },
        ...(currentDeviceId ? { deviceID: { not: currentDeviceId } } : {}),
      },
      select: { feedKey: true, deviceID: true },
    });

    const conflictActuator = await this.prisma.actuatorChannel.findMany({
      where: {
        feedKey: { in: feedsToCheck },
        ...(currentDeviceId ? { deviceID: { not: currentDeviceId } } : {}),
      },
      select: { feedKey: true, deviceID: true },
    });

    const conflicts = [...conflictSensor, ...conflictActuator];
    if (conflicts.length > 0) {
      throw new BadRequestException({
        message: 'Feed key đã được gán cho thiết bị khác.',
        conflicts,
      });
    }

    return { ok: true };
  }

  async update(id: number, dto: Partial<CreateDeviceDto>) {
    const current = await this.findOne(id);

    // Tính firstSensorFeedKey cho backward compat
    const firstSensorFeedKey =
      dto.sensorChannels && dto.sensorChannels.length > 0
        ? this.normalizeFeedKey(dto.sensorChannels[0].feedKey)
        : dto.mqttTopicSensor !== undefined
          ? this.normalizeFeedKey(dto.mqttTopicSensor)
          : this.pickSingleFeed(current.mqttTopicSensor);

    const firstActuatorFeedKey =
      dto.actuatorChannels && dto.actuatorChannels.length > 0
        ? this.normalizeFeedKey(dto.actuatorChannels[0].feedKey)
        : dto.mqttTopicCmd !== undefined
          ? this.normalizeFeedKey(dto.mqttTopicCmd)
          : this.pickSingleFeed(current.mqttTopicCmd);

    const updated = await this.prisma.device.update({
      where: { deviceID: id },
      data: {
        deviceName: dto.deviceName,
        deviceStatus: dto.deviceStatus,
        deviceType: dto.deviceType,
        mqttTopicSensor: firstSensorFeedKey || null,
        mqttTopicCmd: firstActuatorFeedKey || null,
        zoneID: dto.zoneID,
        organizationID: dto.organizationID,
        factoryID: dto.factoryID,
        siteID: dto.siteID,
        metaData: this.normalizeMetaData(
          current.metaData,
          dto,
          firstSensorFeedKey,
        ),
      },
    });

    // Cập nhật channels nếu có trong request
    if (Array.isArray(dto.sensorChannels)) {
      await this.upsertSensorChannels(id, dto.sensorChannels);
    }
    if (Array.isArray(dto.actuatorChannels)) {
      await this.upsertActuatorChannels(id, dto.actuatorChannels);
    }

    await this.refreshMqttSubscriptionsFromDevices();
    return this.findOne(updated.deviceID);
  }

  async remove(id: number) {
    await this.findOne(id);
    const deleted = await this.prisma.device.delete({
      where: { deviceID: id },
    });
    await this.refreshMqttSubscriptionsFromDevices();
    return this.mapDeviceResponse({
      ...deleted,
      sensorChannels: [],
    });
  }
}
