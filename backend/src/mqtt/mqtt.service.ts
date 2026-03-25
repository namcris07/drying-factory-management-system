import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttClient, connect } from 'mqtt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type FeedState = {
  feed: string;
  topic: string;
  value: unknown;
  source: 'adafruit' | 'server-command' | 'server-simulate';
  updatedAt: string;
};

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;
  private isConnected = false;

  // Lưu state gần nhất để app FE có thể đọc nhanh và đồng bộ hai chiều
  private readonly feedState = new Map<string, FeedState>();
  private subscribedFeeds = new Set<string>();

  private readonly brokerUrl: string;
  private readonly username: string;
  private readonly aioKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.brokerUrl = this.configService.get<string>(
      'ADAFRUIT_IO_BROKER_URL',
      'mqtt://io.adafruit.com:1883',
    );
    this.username = this.configService.get<string>('ADAFRUIT_IO_USERNAME', '');
    this.aioKey = this.configService.get<string>('ADAFRUIT_IO_KEY', '');
  }

  onModuleInit() {
    if (!this.isMqttEnabled()) {
      this.logger.warn(
        'MQTT disabled: thiếu ADAFRUIT_IO_USERNAME/ADAFRUIT_IO_KEY thật trong .env',
      );
      return;
    }

    this.client = connect(this.brokerUrl, {
      username: this.username,
      password: this.aioKey,
      clientId: `dadn_backend_${Math.random().toString(16).slice(2, 10)}`,
      keepalive: 60,
      reconnectPeriod: 3000,
      clean: true,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Da ket noi Adafruit IO MQTT thanh cong.');
      this.subscribeToFeeds();
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Dang reconnect MQTT...');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('MQTT connection da dong.');
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      void this.processIncomingTopic(topic, payload, 'adafruit');
    });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      this.isConnected = false;
    }
  }

  subscribeToFeeds(feeds?: string[]) {
    if (!this.client || !this.isConnected) {
      this.logger.warn('Subscribe bo qua vi MQTT client chua san sang.');
      return;
    }

    const targetFeeds =
      feeds && feeds.length > 0 ? feeds : this.getDefaultSubscribeFeeds();

    if (targetFeeds.length === 0) {
      this.logger.warn('Khong co feed nao de subscribe.');
      return;
    }

    const topics = targetFeeds.map((feed) => this.toTopic(feed));

    this.client.subscribe(topics, { qos: 0 }, (err) => {
      if (err) {
        this.logger.error(`Subscribe that bai: ${err.message}`);
        return;
      }

      this.subscribedFeeds = new Set(targetFeeds);
      this.logger.log(`Dang lang nghe feeds: ${targetFeeds.join(', ')}`);
    });
  }

  async publishCommand(
    feed: string,
    value: unknown,
    optimisticSync = true,
  ): Promise<{ ok: boolean; topic: string; payload: string; note?: string }> {
    if (value === undefined) {
      throw new BadRequestException('value la bat buoc khi publish command');
    }

    const topic = this.toTopic(feed);
    const payload = this.toPayload(value);

    if (!this.client || !this.isConnected) {
      if (optimisticSync) {
        await this.saveState(feed, topic, value, 'server-command');
      }

      await this.persistSensorLog({
        direction: 'outgoing',
        source: 'server-command',
        topic,
        feed,
        value,
        raw: payload,
      });

      const note =
        'MQTT client chua ket noi. Lenh da duoc luu state local, chua gui toi Adafruit.';
      this.logger.warn(`${note} Feed=${feed}`);
      return {
        ok: false,
        topic,
        payload,
        note,
      };
    }

    await new Promise<void>((resolve, reject) => {
      this.client?.publish(topic, payload, { qos: 0, retain: false }, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    if (optimisticSync) {
      await this.saveState(feed, topic, value, 'server-command');
    }

    await this.persistSensorLog({
      direction: 'outgoing',
      source: 'server-command',
      topic,
      feed,
      value,
      raw: payload,
    });

    this.logger.log(`Da publish command: ${topic} -> ${payload}`);
    return { ok: true, topic, payload };
  }

  async simulateIncomingFeed(feed: string, value: unknown) {
    if (value === undefined) {
      throw new BadRequestException('value la bat buoc khi simulate incoming');
    }

    const topic = this.toTopic(feed);
    const payload = Buffer.from(this.toPayload(value), 'utf8');
    await this.processIncomingTopic(topic, payload, 'server-simulate');

    return {
      ok: true,
      topic,
      feed,
      value,
      note: 'Da gia lap incoming message nhu tu Adafruit/Thiet bi gui ve.',
    };
  }

  getConnectionStatus() {
    const enabled = this.isMqttEnabled();
    const reason = !enabled
      ? 'ADAFRUIT_IO_USERNAME/ADAFRUIT_IO_KEY dang la placeholder hoac de trong.'
      : !this.isConnected
        ? 'Da cau hinh key nhung chua ket noi duoc broker (mang/firewall/sai key).'
        : 'connected';

    return {
      enabled,
      connected: this.isConnected,
      brokerUrl: this.brokerUrl,
      username: this.username,
      subscribedFeeds: Array.from(this.subscribedFeeds),
      reason,
    };
  }

  getFeedState() {
    return Array.from(this.feedState.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  private isMqttEnabled() {
    return (
      !!this.username &&
      !!this.aioKey &&
      this.username !== 'your_adafruit_username' &&
      this.aioKey !== 'your_adafruit_aio_key'
    );
  }

  private getDefaultSubscribeFeeds() {
    const defaultFeeds = [
      'temperature',
      'humidity',
      'light',
      'fan_state',
      'fan_level',
      'relay_state',
      'led_state',
      'lcd_text',
      'device_status',
    ];

    const fromEnv = this.configService.get<string>(
      'ADAFRUIT_IO_SUBSCRIBE_FEEDS',
    );
    if (!fromEnv) {
      return defaultFeeds;
    }

    return fromEnv
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private toTopic(feed: string) {
    return `${this.username}/feeds/${feed}`;
  }

  private toPayload(value: unknown) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  private extractFeedFromTopic(topic: string) {
    const parts = topic.split('/');
    const feed = parts.length >= 3 ? parts[2] : topic;
    return feed;
  }

  private parsePayload(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed === '') return '';

    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }

  private async processIncomingTopic(
    topic: string,
    payload: Buffer,
    source: 'adafruit' | 'server-simulate',
  ) {
    const raw = payload.toString('utf8');
    const value = this.parsePayload(raw);
    const feed = this.extractFeedFromTopic(topic);

    await this.saveState(feed, topic, value, source);

    await this.persistSensorLog({
      direction: 'incoming',
      source,
      topic,
      feed,
      value,
      raw,
    });

    this.logger.log(`Incoming feed ${feed}: ${raw}`);
  }

  private async saveState(
    feed: string,
    topic: string,
    value: unknown,
    source: 'adafruit' | 'server-command' | 'server-simulate',
  ) {
    const state: FeedState = {
      feed,
      topic,
      value,
      source,
      updatedAt: new Date().toISOString(),
    };

    this.feedState.set(feed, state);

    // Lưu snapshot trạng thái để server restart vẫn có dữ liệu gần nhất cho app
    await this.prisma.systemConfig.upsert({
      where: { configKey: `mqtt:last:${feed}` },
      create: {
        configKey: `mqtt:last:${feed}`,
        configValue: JSON.stringify(state),
      },
      update: {
        configValue: JSON.stringify(state),
      },
    });
  }

  private async persistSensorLog(data: {
    direction: 'incoming' | 'outgoing';
    source: 'adafruit' | 'server-command' | 'server-simulate';
    topic: string;
    feed: string;
    value: unknown;
    raw: string;
  }) {
    const safeValue = this.normalizeForJson(data.value);

    await this.prisma.sensorDataLog.create({
      data: {
        logTimestamp: new Date(),
        measurements: {
          direction: data.direction,
          source: data.source,
          topic: data.topic,
          feed: data.feed,
          value: safeValue,
          raw: data.raw,
          receivedAt: new Date().toISOString(),
        },
      },
    });
  }

  private normalizeForJson(value: unknown): Prisma.InputJsonValue | null {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    try {
      return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    } catch {
      return String(value);
    }
  }
}
