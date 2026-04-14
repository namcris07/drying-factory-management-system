import { Injectable, NotFoundException } from '@nestjs/common';
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

  private extractSensorFeeds(dto: Partial<CreateDeviceDto>): string[] {
    const fromArray = (dto.sensorFeeds ?? [])
      .map((feed) => String(feed ?? '').trim())
      .filter(Boolean);

    const fromText = this.splitFeedText(dto.mqttTopicSensor);

    return Array.from(new Set([...fromArray, ...fromText]));
  }

  private extractSensorFeedsFromDevice(device: {
    mqttTopicSensor: string | null;
    metaData: Prisma.JsonValue | null;
  }): string[] {
    const fromText = this.splitFeedText(device.mqttTopicSensor);
    const meta = device.metaData;

    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      return Array.from(new Set(fromText));
    }

    const fromMeta = Array.isArray(
      (meta as { sensorFeeds?: unknown }).sensorFeeds,
    )
      ? ((meta as { sensorFeeds?: unknown }).sensorFeeds as unknown[])
          .map((feed) => String(feed ?? '').trim())
          .filter(Boolean)
      : [];

    return Array.from(new Set([...fromMeta, ...fromText]));
  }

  private mapDeviceResponse<
    T extends {
      mqttTopicSensor: string | null;
      metaData: Prisma.JsonValue | null;
    },
  >(device: T): T & { sensorFeeds: string[] } {
    return {
      ...device,
      sensorFeeds: this.extractSensorFeedsFromDevice(device),
    };
  }

  private normalizeMetaData(
    existing: Prisma.JsonValue | null | undefined,
    next: Partial<CreateDeviceDto>,
    sensorFeeds: string[],
  ): Prisma.InputJsonValue {
    const base =
      next.metaData !== undefined
        ? next.metaData
        : existing && typeof existing === 'object' && !Array.isArray(existing)
          ? (existing as Record<string, unknown>)
          : {};

    return {
      ...base,
      sensorFeeds,
    } as Prisma.InputJsonValue;
  }

  private async refreshMqttSubscriptionsFromDevices() {
    const rows = await this.prisma.device.findMany({
      select: {
        mqttTopicSensor: true,
        metaData: true,
      },
    });

    const feeds = new Set<string>();

    for (const row of rows) {
      for (const feed of this.splitFeedText(row.mqttTopicSensor)) {
        feeds.add(feed);
      }

      const meta = row.metaData;
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) continue;

      const sensorFeeds = (meta as { sensorFeeds?: unknown }).sensorFeeds ?? [];
      if (!Array.isArray(sensorFeeds)) continue;

      for (const feed of sensorFeeds) {
        const normalized = String(feed ?? '').trim();
        if (normalized) feeds.add(normalized);
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

  findAll() {
    return this.prisma.device
      .findMany({
        include: { zone: { select: { zoneID: true, zoneName: true } } },
        orderBy: { deviceID: 'asc' },
      })
      .then((rows) => rows.map((row) => this.mapDeviceResponse(row)));
  }

  async findOne(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { deviceID: id },
      include: { zone: { select: { zoneID: true, zoneName: true } } },
    });
    if (!device) throw new NotFoundException(`Device ${id} not found`);
    return this.mapDeviceResponse(device);
  }

  async create(dto: CreateDeviceDto) {
    const sensorFeeds = this.extractSensorFeeds(dto);
    const payload = {
      deviceName: dto.deviceName,
      deviceStatus: dto.deviceStatus,
      deviceType: dto.deviceType,
      mqttTopicSensor:
        sensorFeeds.length > 0 ? sensorFeeds.join(',') : dto.mqttTopicSensor,
      mqttTopicCmd: dto.mqttTopicCmd,
      zoneID: dto.zoneID,
      metaData: this.normalizeMetaData(undefined, dto, sensorFeeds),
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

  async update(id: number, dto: Partial<CreateDeviceDto>) {
    const current = await this.findOne(id);
    const sensorFeeds = this.extractSensorFeeds(dto);

    const requestedFeedUpdate =
      dto.sensorFeeds !== undefined || dto.mqttTopicSensor !== undefined;
    if (requestedFeedUpdate && sensorFeeds.length === 0) {
      const deleted = await this.prisma.device.delete({
        where: { deviceID: id },
      });
      await this.refreshMqttSubscriptionsFromDevices();
      return {
        ...this.mapDeviceResponse(deleted),
        deletedBecauseNoSensors: true,
      };
    }

    const updated = await this.prisma.device.update({
      where: { deviceID: id },
      data: {
        deviceName: dto.deviceName,
        deviceStatus: dto.deviceStatus,
        deviceType: dto.deviceType,
        mqttTopicSensor:
          sensorFeeds.length > 0 ? sensorFeeds.join(',') : dto.mqttTopicSensor,
        mqttTopicCmd: dto.mqttTopicCmd,
        zoneID: dto.zoneID,
        metaData: this.normalizeMetaData(current.metaData, dto, sensorFeeds),
      },
    });

    const topicChanged = dto.mqttTopicSensor !== undefined;
    const feedsChanged = dto.sensorFeeds !== undefined;
    if (topicChanged || feedsChanged) {
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
