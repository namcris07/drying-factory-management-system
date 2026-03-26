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
import { ModeControlService } from './mode-control.service';

type FeedState = {
  feed: string;
  topic: string;
  value: unknown;
  source: 'adafruit' | 'server-command' | 'server-simulate';
  updatedAt: string;
};

type MetricKey = 'temperature' | 'humidity' | 'light';

type ThresholdConfig = {
  maxTempSafe: number;
  minHumidity: number;
  maxHumidity: number;
  autoStopEnabled: boolean;
  alertDelaySeconds: number;
  lightSensorThreshold: number;
  doorOpenTimeout: number;
};

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  maxTempSafe: 90,
  minHumidity: 8,
  maxHumidity: 85,
  autoStopEnabled: true,
  alertDelaySeconds: 15,
  lightSensorThreshold: 500,
  doorOpenTimeout: 5,
};

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;
  private isConnected = false;

  // Lưu state gần nhất để app FE có thể đọc nhanh và đồng bộ hai chiều
  private readonly feedState = new Map<string, FeedState>();
  private subscribedFeeds = new Set<string>();
  private readonly metricState = new Map<MetricKey, number>();
  private readonly metricOutOfRangeSince = new Map<string, number>();
  private readonly doorOpenSince = new Map<string, number>();
  private readonly pendingAlertTimers = new Map<string, NodeJS.Timeout>();

  private readonly brokerUrl: string;
  private readonly username: string;
  private readonly aioKey: string;
  private readonly modeFeedKey: string;
  private readonly lcdFeedKey: string;
  private lcdAutoPushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly modeControl: ModeControlService,
  ) {
    this.brokerUrl = this.configService.get<string>(
      'ADAFRUIT_IO_BROKER_URL',
      'mqtt://io.adafruit.com:1883',
    );
    this.username = this.configService.get<string>('ADAFRUIT_IO_USERNAME', '');
    this.aioKey = this.configService.get<string>('ADAFRUIT_IO_KEY', '');
    this.modeFeedKey = this.configService.get<string>(
      'ADAFRUIT_IO_MODE_FEED',
      'mode_state',
    );
    this.lcdFeedKey = this.configService.get<string>(
      'ADAFRUIT_IO_LCD_FEED',
      'lcd_text',
    );
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
      this.startLcdAutoPushLoop();
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Dang reconnect MQTT...');
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('MQTT connection da dong.');
      this.stopLcdAutoPushLoop();
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      void this.processIncomingTopic(topic, payload, 'adafruit');
    });
  }

  onModuleDestroy() {
    this.stopLcdAutoPushLoop();
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

    // Check if this is a device control feed and if mode allows it
    if (this.isDeviceControlFeed(feed)) {
      const mode = await this.modeControl.getCurrentMode();
      if (mode === 'auto') {
        const note =
          'Hệ thống đang chạy ở chế độ Auto. Không thể điều khiển thiết bị thủ công.';
        this.logger.warn(
          `publishCommand bị chặn (AUTO mode): ${feed} = ${value}`,
        );
        return {
          ok: false,
          topic: this.toTopic(feed),
          payload: this.toPayload(value),
          note,
        };
      }
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
      this.lcdFeedKey,
      'device_status',
      this.modeFeedKey,
    ];

    const fromEnv = this.configService.get<string>(
      'ADAFRUIT_IO_SUBSCRIBE_FEEDS',
    );
    if (!fromEnv) {
      return Array.from(new Set(defaultFeeds));
    }

    const envFeeds = fromEnv
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return Array.from(new Set([...envFeeds, this.modeFeedKey]));
  }

  /**
   * Check if a feed is a device control command feed (not a sensor data feed)
   * Device control feeds: fan_state, fan_level, relay_state, led_state, etc.
   * Sensor feeds: temperature, humidity, light, device_status
   */
  private isDeviceControlFeed(feed: string): boolean {
    const controlFeeds = [
      'fan_state',
      'fan_level',
      'relay_state',
      'led_state',
      'heater_state',
      'humidifier_state',
      'door_lock',
    ];
    return controlFeeds.some(
      (cf) =>
        feed.toLowerCase().includes(cf) || cf.includes(feed.toLowerCase()),
    );
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

    await this.syncOperatingModeFromFeed(feed, value, source);

    await this.persistSensorLog({
      direction: 'incoming',
      source,
      topic,
      feed,
      value,
      raw,
    });

    await this.evaluateThresholdAlerts(feed, value);

    this.logger.log(`Incoming feed ${feed}: ${raw}`);
  }

  private normalizeFeedKey(feed: string): string {
    return feed.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private isModeFeed(feed: string): boolean {
    return (
      this.normalizeFeedKey(feed) === this.normalizeFeedKey(this.modeFeedKey)
    );
  }

  private parseOperatingModeValue(value: unknown): 'auto' | 'manual' | null {
    if (value === 1 || value === '1' || value === true) return 'auto';
    if (value === 0 || value === '0' || value === false) return 'manual';

    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'auto' || normalized === 'a' || normalized === 'on') {
      return 'auto';
    }
    if (normalized === 'manual' || normalized === 'm' || normalized === 'off') {
      return 'manual';
    }

    return null;
  }

  private async syncOperatingModeFromFeed(
    feed: string,
    value: unknown,
    source: 'adafruit' | 'server-simulate',
  ): Promise<void> {
    if (!this.isModeFeed(feed)) return;

    const parsedMode = this.parseOperatingModeValue(value);
    if (!parsedMode) {
      this.logger.warn(
        `Bo qua mode feed khong hop le: ${feed}=${String(value)}`,
      );
      return;
    }

    const current = await this.prisma.systemConfig.findUnique({
      where: { configKey: 'operatingMode' },
      select: { configValue: true },
    });

    if (current?.configValue === parsedMode) return;

    await this.prisma.$transaction([
      this.prisma.systemConfig.upsert({
        where: { configKey: 'operatingMode' },
        create: { configKey: 'operatingMode', configValue: parsedMode },
        update: { configValue: parsedMode },
      }),
      this.prisma.systemConfigUpdate.create({
        data: {
          configKey: 'operatingMode',
          updatedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(
      `Da dong bo operatingMode='${parsedMode}' tu mode feed (${source}).`,
    );
  }

  private async evaluateThresholdAlerts(feed: string, value: unknown) {
    const metric = this.detectMetric(feed);
    if (!metric) return;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;

    this.metricState.set(metric, numericValue);

    const thresholds = await this.getThresholdConfig();
    const device = await this.resolveDeviceByFeed(feed);
    const deviceId = device?.deviceID ?? null;
    const deviceName = device?.deviceName || 'Thiết bị sấy';

    if (metric === 'temperature') {
      await this.handleMetricAlert({
        conditionKey: `temp_high:${deviceId ?? 'global'}`,
        active: numericValue > thresholds.maxTempSafe,
        delaySeconds: thresholds.alertDelaySeconds,
        deviceId,
        alertType: 'error',
        alertMessage: `${deviceName}: Nhiệt độ vượt ngưỡng an toàn (${thresholds.maxTempSafe}°C).`,
      });
      return;
    }

    if (metric === 'humidity') {
      await this.handleMetricAlert({
        conditionKey: `hum_low:${deviceId ?? 'global'}`,
        active: numericValue < thresholds.minHumidity,
        delaySeconds: thresholds.alertDelaySeconds,
        deviceId,
        alertType: 'warning',
        alertMessage: `${deviceName}: Độ ẩm thấp hơn ngưỡng tối thiểu (${thresholds.minHumidity}%).`,
      });

      await this.handleMetricAlert({
        conditionKey: `hum_high:${deviceId ?? 'global'}`,
        active: numericValue > thresholds.maxHumidity,
        delaySeconds: thresholds.alertDelaySeconds,
        deviceId,
        alertType: 'warning',
        alertMessage: `${deviceName}: Độ ẩm vượt ngưỡng tối đa (${thresholds.maxHumidity}%).`,
      });
      return;
    }

    const doorKey = `${deviceId ?? 'global'}`;
    const isDoorLikelyOpen = numericValue > thresholds.lightSensorThreshold;

    if (isDoorLikelyOpen) {
      if (!this.doorOpenSince.has(doorKey)) {
        this.doorOpenSince.set(doorKey, Date.now());
      }
    } else {
      this.doorOpenSince.delete(doorKey);
      this.metricOutOfRangeSince.delete(`door_open:${doorKey}`);
      this.metricOutOfRangeSince.delete(`heat_loss:${doorKey}`);
      await this.resolveOpenAlertsByMessage(
        deviceId,
        `${deviceName}: Ánh sáng vượt ngưỡng trong thời gian dài, khả năng cửa buồng sấy đang mở.`,
      );
      await this.resolveOpenAlertsByMessage(
        deviceId,
        `${deviceName}: Nguy cơ thất thoát nhiệt do cửa mở khi buồng đang nóng.`,
      );
      return;
    }

    const openedAt = this.doorOpenSince.get(doorKey) ?? Date.now();
    const openDurationMs = Date.now() - openedAt;
    const openTimeoutMs = Math.max(1, thresholds.doorOpenTimeout) * 60_000;
    const timeoutReached = openDurationMs >= openTimeoutMs;

    await this.handleMetricAlert({
      conditionKey: `door_open:${doorKey}`,
      active: timeoutReached,
      delaySeconds: thresholds.alertDelaySeconds,
      deviceId,
      alertType: 'warning',
      alertMessage: `${deviceName}: Ánh sáng vượt ngưỡng trong thời gian dài, khả năng cửa buồng sấy đang mở.`,
    });

    const latestTemp = this.metricState.get('temperature') ?? 0;
    const possibleHeatLoss =
      timeoutReached && latestTemp >= thresholds.maxTempSafe * 0.8;

    await this.handleMetricAlert({
      conditionKey: `heat_loss:${doorKey}`,
      active: possibleHeatLoss,
      delaySeconds: thresholds.alertDelaySeconds,
      deviceId,
      alertType: 'error',
      alertMessage: `${deviceName}: Nguy cơ thất thoát nhiệt do cửa mở khi buồng đang nóng.`,
    });
  }

  private detectMetric(feed: string): MetricKey | null {
    const normalized = feed.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (
      normalized.includes('temperature') ||
      normalized.includes('temp') ||
      normalized.includes('bbctemp')
    ) {
      return 'temperature';
    }

    if (normalized.includes('humidity') || normalized.includes('hum')) {
      return 'humidity';
    }

    if (
      normalized.includes('light') ||
      normalized.includes('lux') ||
      normalized.includes('ldr')
    ) {
      return 'light';
    }

    return null;
  }

  private async getThresholdConfig(): Promise<ThresholdConfig> {
    const targetKeys = [
      'maxTempSafe',
      'minHumidity',
      'maxHumidity',
      'autoStopEnabled',
      'alertDelaySeconds',
      'lightSensorThreshold',
      'doorOpenTimeout',
    ];

    const rows = await this.prisma.systemConfig.findMany({
      where: { configKey: { in: targetKeys } },
    });

    const byKey = new Map(
      rows.map((row) => [row.configKey, row.configValue ?? '']),
    );

    return {
      maxTempSafe: Number(
        byKey.get('maxTempSafe') ?? DEFAULT_THRESHOLDS.maxTempSafe,
      ),
      minHumidity: Number(
        byKey.get('minHumidity') ?? DEFAULT_THRESHOLDS.minHumidity,
      ),
      maxHumidity: Number(
        byKey.get('maxHumidity') ?? DEFAULT_THRESHOLDS.maxHumidity,
      ),
      autoStopEnabled:
        String(
          byKey.get('autoStopEnabled') ??
            String(DEFAULT_THRESHOLDS.autoStopEnabled),
        ) === 'true',
      alertDelaySeconds: Number(
        byKey.get('alertDelaySeconds') ?? DEFAULT_THRESHOLDS.alertDelaySeconds,
      ),
      lightSensorThreshold: Number(
        byKey.get('lightSensorThreshold') ??
          DEFAULT_THRESHOLDS.lightSensorThreshold,
      ),
      doorOpenTimeout: Number(
        byKey.get('doorOpenTimeout') ?? DEFAULT_THRESHOLDS.doorOpenTimeout,
      ),
    };
  }

  private async resolveDeviceByFeed(feed: string) {
    const mapped = await this.prisma.device.findFirst({
      where: {
        OR: [
          { mqttTopicSensor: { contains: feed, mode: 'insensitive' } },
          { mqttTopicCmd: { contains: feed, mode: 'insensitive' } },
        ],
      },
      select: {
        deviceID: true,
        deviceName: true,
      },
    });

    if (mapped) return mapped;

    // Shared-feed mode can omit machine id in feed key; fallback to a single active device.
    return this.prisma.device.findFirst({
      where: { deviceStatus: 'Active' },
      select: {
        deviceID: true,
        deviceName: true,
      },
      orderBy: { deviceID: 'asc' },
    });
  }

  private async handleMetricAlert(params: {
    conditionKey: string;
    active: boolean;
    delaySeconds: number;
    deviceId: number | null;
    alertType: string;
    alertMessage: string;
  }) {
    const {
      conditionKey,
      active,
      delaySeconds,
      deviceId,
      alertType,
      alertMessage,
    } = params;

    const now = Date.now();

    if (!active) {
      this.metricOutOfRangeSince.delete(conditionKey);
      this.clearPendingAlertTimer(conditionKey);
      await this.resolveOpenAlertsByMessage(deviceId, alertMessage);
      return;
    }

    const startedAt = this.metricOutOfRangeSince.get(conditionKey) ?? now;
    this.metricOutOfRangeSince.set(conditionKey, startedAt);

    const reachedDelay = now - startedAt >= Math.max(0, delaySeconds) * 1000;
    if (reachedDelay) {
      this.clearPendingAlertTimer(conditionKey);
      await this.createPendingAlertIfNeeded(deviceId, alertType, alertMessage);
      return;
    }

    this.scheduleDelayedAlert(
      conditionKey,
      delaySeconds,
      startedAt,
      async () => {
        if (!this.metricOutOfRangeSince.has(conditionKey)) return;
        await this.createPendingAlertIfNeeded(
          deviceId,
          alertType,
          alertMessage,
        );
      },
    );
  }

  private scheduleDelayedAlert(
    conditionKey: string,
    delaySeconds: number,
    startedAt: number,
    callback: () => Promise<void>,
  ) {
    if (this.pendingAlertTimers.has(conditionKey)) return;

    const targetAt = startedAt + Math.max(0, delaySeconds) * 1000;
    const waitMs = Math.max(0, targetAt - Date.now());

    const timer = setTimeout(() => {
      this.pendingAlertTimers.delete(conditionKey);
      void callback();
    }, waitMs);

    this.pendingAlertTimers.set(conditionKey, timer);
  }

  private clearPendingAlertTimer(conditionKey: string) {
    const timer = this.pendingAlertTimers.get(conditionKey);
    if (!timer) return;
    clearTimeout(timer);
    this.pendingAlertTimers.delete(conditionKey);
  }

  private async createPendingAlertIfNeeded(
    deviceId: number | null,
    alertType: string,
    alertMessage: string,
  ) {
    const existing = await this.prisma.alert.findFirst({
      where: {
        deviceID: deviceId,
        alertMessage,
        alertStatus: { in: ['pending', 'acknowledged'] },
      },
      select: { alertID: true },
    });

    if (existing) return;

    await this.prisma.alert.create({
      data: {
        deviceID: deviceId,
        alertType,
        alertMessage,
        alertStatus: 'pending',
        alertTime: new Date(),
      },
    });
  }

  private async resolveOpenAlertsByMessage(
    deviceId: number | null,
    alertMessage: string,
  ) {
    const openAlerts = await this.prisma.alert.findMany({
      where: {
        deviceID: deviceId,
        alertMessage,
        alertStatus: { in: ['pending', 'acknowledged'] },
      },
      select: { alertID: true },
    });

    if (openAlerts.length === 0) return;

    await this.prisma.$transaction(
      openAlerts.flatMap((alert) => [
        this.prisma.alert.update({
          where: { alertID: alert.alertID },
          data: { alertStatus: 'resolved' },
        }),
        this.prisma.alertResolution.create({
          data: {
            alertID: alert.alertID,
            resolveStatus: 'auto_resolved',
            resolveNote: 'Tự động đóng khi thông số quay lại ngưỡng an toàn.',
            resolveTime: new Date(),
          },
        }),
      ]),
    );
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

  private startLcdAutoPushLoop(): void {
    if (this.lcdAutoPushTimer) return;

    const run = () => {
      void this.publishLcdSnapshot();
    };

    run();
    this.lcdAutoPushTimer = setInterval(run, 5000);
    this.logger.log(
      `Da bat auto-update LCD moi 5s qua feed ${this.lcdFeedKey}.`,
    );
  }

  private stopLcdAutoPushLoop(): void {
    if (!this.lcdAutoPushTimer) return;
    clearInterval(this.lcdAutoPushTimer);
    this.lcdAutoPushTimer = null;
  }

  private formatMetric(value: number | undefined, unit: string): string {
    if (!Number.isFinite(value)) return `--${unit}`;
    return `${value!.toFixed(1)}${unit}`;
  }

  private toLcdLine(text: string): string {
    return text.slice(0, 16).padEnd(16, ' ');
  }

  private async publishLcdSnapshot(): Promise<void> {
    if (!this.client || !this.isConnected) return;

    const thresholds = await this.getThresholdConfig();

    const temperature = this.metricState.get('temperature');
    const humidity = this.metricState.get('humidity');
    const light = this.metricState.get('light');

    const doorStatus = Number.isFinite(light)
      ? light! > thresholds.lightSensorThreshold
        ? 'OPEN'
        : 'CLOSE'
      : 'N/A';

    const line1 = this.toLcdLine(
      `T:${this.formatMetric(temperature, 'C')} H:${this.formatMetric(humidity, '%')}`,
    );
    const line2 = this.toLcdLine(`Door:${doorStatus}`);
    const lcdMessage = `${line1}${line2}`;

    await this.publishCommand(this.lcdFeedKey, lcdMessage, true);
  }
}
