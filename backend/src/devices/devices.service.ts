import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class DevicesService {
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

  private assertSingleFeedFormat(raw: string | null | undefined): string {
    const feeds = this.splitFeedText(raw)
      .map((feed) => this.normalizeFeedKey(feed))
      .filter(Boolean);

    if (feeds.length > 1) {
      throw new ConflictException({
        message: 'Mỗi thiết bị chỉ được phép có duy nhất 1 feed key.',
      });
    }

    return feeds[0] ?? '';
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

  private async assertNoFeedConflicts(
    dto: Partial<CreateDeviceDto>,
    currentDeviceId?: number,
  ) {
    const requestedFeed = this.assertSingleFeedFormat(dto.mqttTopicSensor);
    if (!requestedFeed) return;

    const rows = await this.prisma.device.findMany({
      select: {
        deviceID: true,
        mqttTopicSensor: true,
      },
    });

    const feedOwners = new Map<string, Set<number>>();
    for (const row of rows) {
      if (currentDeviceId && row.deviceID === currentDeviceId) continue;

      const feed = this.pickSingleFeed(row.mqttTopicSensor);
      const key = this.normalizeFeedKey(feed);
      if (key) {
        if (!feedOwners.has(key)) {
          feedOwners.set(key, new Set<number>());
        }
        feedOwners.get(key)?.add(row.deviceID);
      }

      for (const legacyFeed of this.splitFeedText(row.mqttTopicSensor).slice(
        1,
      )) {
        const key = this.normalizeFeedKey(legacyFeed);
        if (!key) continue;
        if (!feedOwners.has(key)) {
          feedOwners.set(key, new Set<number>());
        }
        feedOwners.get(key)?.add(row.deviceID);
      }
    }

    const conflictDetails = [requestedFeed]
      .filter((feed) => feedOwners.has(feed))
      .map((feed) => ({
        feed,
        deviceIDs: Array.from(feedOwners.get(feed) ?? []),
      }));

    if (conflictDetails.length > 0) {
      throw new ConflictException({
        message: 'Feed key đã được gán cho thiết bị khác.',
        conflicts: conflictDetails,
      });
    }
  }

  private mapDeviceResponse<
    T extends {
      mqttTopicSensor: string | null;
      metaData: Prisma.JsonValue | null;
    },
  >(device: T): T & { sensorFeeds: string[] } {
    const singleFeed = this.pickSingleFeed(device.mqttTopicSensor);
    return {
      ...device,
      sensorFeeds: singleFeed ? [singleFeed] : [],
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

  private async refreshMqttSubscriptionsFromDevices() {
    const rows = await this.prisma.device.findMany({
      select: {
        mqttTopicSensor: true,
      },
    });

    const feeds = new Set<string>();

    for (const row of rows) {
      const feed = this.pickSingleFeed(row.mqttTopicSensor);
      if (feed) feeds.add(feed);
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

  findAll() {
    return this.prisma.device
      .findMany({
        orderBy: { deviceID: 'asc' },
      })
      .then((rows) => this.attachZonesByZoneId(rows))
      .then((rows) => rows.map((row) => this.mapDeviceResponse(row)));
  }

  async findOne(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { deviceID: id },
    });
    if (!device) throw new NotFoundException(`Device ${id} not found`);

    const [withZone] = await this.attachZonesByZoneId([device]);
    return this.mapDeviceResponse(withZone);
  }

  async create(dto: CreateDeviceDto) {
    await this.assertNoFeedConflicts(dto);
    const feedKey = this.assertSingleFeedFormat(dto.mqttTopicSensor);
    if (!feedKey) {
      throw new BadRequestException('Thiết bị phải có đúng 1 feed key.');
    }
    const payload = {
      deviceName: dto.deviceName,
      deviceStatus: dto.deviceStatus,
      deviceType: dto.deviceType,
      mqttTopicSensor: feedKey || null,
      mqttTopicCmd: null,
      zoneID: dto.zoneID,
      metaData: this.normalizeMetaData(undefined, dto, feedKey),
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

    await this.refreshMqttSubscriptionsFromDevices();
    return this.findOne(created.deviceID);
  }

  async validateFeedConflicts(
    dto: {
      mqttTopicSensor?: string;
    },
    currentDeviceId?: number,
  ) {
    await this.assertNoFeedConflicts(dto, currentDeviceId);
    return { ok: true };
  }

  async update(id: number, dto: Partial<CreateDeviceDto>) {
    const current = await this.findOne(id);
    const requestedSensorUpdate = dto.mqttTopicSensor !== undefined;
    const nextFeedKey = requestedSensorUpdate
      ? this.assertSingleFeedFormat(dto.mqttTopicSensor)
      : this.pickSingleFeed(current.mqttTopicSensor);

    if (requestedSensorUpdate) {
      await this.assertNoFeedConflicts(
        {
          mqttTopicSensor: nextFeedKey,
        },
        id,
      );
    }

    const nextMetaData = this.normalizeMetaData(
      current.metaData,
      dto,
      nextFeedKey,
    );

    const updated = await this.prisma.device.update({
      where: { deviceID: id },
      data: {
        deviceName: dto.deviceName,
        deviceStatus: dto.deviceStatus,
        deviceType: dto.deviceType,
        mqttTopicSensor: requestedSensorUpdate
          ? nextFeedKey || null
          : undefined,
        mqttTopicCmd: null,
        zoneID: dto.zoneID,
        metaData: nextMetaData,
      },
    });

    const topicChanged = dto.mqttTopicSensor !== undefined;
    if (topicChanged) {
      await this.refreshMqttSubscriptionsFromDevices();
    }

    return this.mapDeviceResponse(updated);
  }

  async remove(id: number) {
    await this.findOne(id);
    const deleted = await this.prisma.device.delete({
      where: { deviceID: id },
    });
    await this.refreshMqttSubscriptionsFromDevices();
    return this.mapDeviceResponse(deleted);
  }
}
