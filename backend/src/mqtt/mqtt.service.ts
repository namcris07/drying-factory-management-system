import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttClient, connect } from 'mqtt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ModeControlService } from './mode-control.service';
import {
  buildLcdSnapshot,
  resolveFormulaThreshold,
  type FormulaThresholdConfig,
} from './mqtt-logic.util';
import {
  AtomRuleSpecification,
  GroupRuleSpecification,
  SensorObservationAdapter,
  SensorStrategyFactory,
  resolveSensorMetric,
  type DynamicFanRuleLike,
  type DynamicFanGroupRuleLike,
  normalizeFeedKey as normalizePatternFeedKey,
} from './mqtt-patterns';

type FeedState = {
  feed: string;
  topic: string;
  value: unknown;
  source: 'adafruit' | 'server-command' | 'server-simulate';
  updatedAt: string;
};

type DeviceFeedState = {
  feed: string;
  sensorType: string;
  topic: string | null;
  value: unknown;
  source: 'adafruit' | 'server-command' | 'server-simulate' | null;
  updatedAt: string | null;
};

type MetricKey = 'temperature' | 'humidity' | 'light';

type ThresholdConfig = {
  maxTempSafe: number;
  minHumidity: number;
  maxHumidity: number;
  tempHysteresisDelta: number;
  humidityHysteresisDelta: number;
  autoFanLevelOn: number;
  autoStopEnabled: boolean;
  alertDelaySeconds: number;
  lightSensorThreshold: number;
  doorOpenTimeout: number;
};

type DynamicControlComparator = 'gte' | 'lte';
type DynamicFanComparator = DynamicControlComparator;

type DynamicFanRuleConfig = {
  id: string;
  enabled: boolean;
  sensorFeed: string;
  comparator: DynamicFanComparator;
  threshold: number;
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
  priority: number;
  cooldownMs: number;
  category: 'critical' | 'normal';
  configKey: string;
};

type DynamicControlGroupOperator = 'AND' | 'OR';
type DynamicFanGroupOperator = DynamicControlGroupOperator;

type DynamicControlGroupCondition = {
  sensorFeed: string;
  comparator: DynamicControlComparator;
  threshold: number;
};

type DynamicFanGroupCondition = DynamicControlGroupCondition;

type DynamicFanGroupOutput = {
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
};

type DynamicFanGroupRuleConfig = {
  id: string;
  enabled: boolean;
  operator: DynamicFanGroupOperator;
  conditions: DynamicFanGroupCondition[];
  outputs: DynamicFanGroupOutput[];
  priority: number;
  cooldownMs: number;
  configKey: string;
};

type DynamicControlConflictConfig = {
  defaultCooldownMs: number;
  allowEqualPriorityTakeover: boolean;
};

type DynamicFanConflictConfig = DynamicControlConflictConfig;

type ResolvedFanAction = {
  ruleId: string;
  fanFeed: string;
  targetLevel: number;
  priority: number;
  cooldownMs: number;
};

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  maxTempSafe: 90,
  minHumidity: 8,
  maxHumidity: 85,
  tempHysteresisDelta: 5,
  humidityHysteresisDelta: 5,
  autoFanLevelOn: 50,
  autoStopEnabled: true,
  alertDelaySeconds: 15,
  lightSensorThreshold: 90,
  doorOpenTimeout: 5,
};

const SENSOR_FAULT_TEMP_MIN = 5;
const SENSOR_FAULT_TEMP_MAX = 120;

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
  private readonly fanLevelFeedKey: string;
  private readonly ledFeedKey: string;
  private readonly sensorObservationAdapter = new SensorObservationAdapter();
  private readonly sensorStrategyFactory = new SensorStrategyFactory();
  private readonly atomRuleSpecification = new AtomRuleSpecification();
  private readonly groupRuleSpecification = new GroupRuleSpecification();
  private lcdAutoPushTimer: NodeJS.Timeout | null = null;
  private lastOperatorLcdMessage = '';
  private publishingAutoLcd = false;
  private readonly tempHysteresisFanState = new Map<string, boolean>();
  private readonly heaterHysteresisState = new Map<string, boolean>();
  private readonly faultyTemperatureFeeds = new Set<string>();
  private allowedPublishFeeds = new Set<string>();
  private allowedPublishFeedsRefreshedAt = 0;
  private dynamicFanRulesCachedAt = 0;
  private dynamicFanRulesCache: DynamicFanRuleConfig[] = [];
  private dynamicFanGroupsCachedAt = 0;
  private dynamicFanGroupsCache: DynamicFanGroupRuleConfig[] = [];
  private dynamicFanConflictCachedAt = 0;
  private dynamicFanConflictCache: DynamicFanConflictConfig = {
    defaultCooldownMs: 5000,
    allowEqualPriorityTakeover: false,
  };
  private fanRuleResolutionState = new Map<
    string,
    { ruleId: string; priority: number; value: number; appliedAt: number }
  >();

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
      '',
    );
    this.fanLevelFeedKey = this.configService.get<string>(
      'ADAFRUIT_IO_FAN_LEVEL_FEED',
      '',
    );
    this.ledFeedKey = this.configService.get<string>(
      'ADAFRUIT_IO_LED_FEED',
      '',
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
      void this.refreshAllowedPublishFeeds(true);
      void this.refreshSubscriptionsFromDevices();
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

    const requestedFeeds =
      feeds && feeds.length > 0
        ? feeds
            .map((item) => this.parseFeedKey(item))
            .filter((item): item is string => !!item)
        : [];
    const targetFeeds = Array.from(
      new Set([...this.getDefaultSubscribeFeeds(), ...requestedFeeds]),
    );

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

  async refreshSubscriptionsFromDevices() {
    const deviceFeeds = await this.getConfiguredFeedsFromDevices();
    const fallbackFeeds = this.getFallbackSubscribeFeeds();

    const selectedFeeds = deviceFeeds.length > 0 ? deviceFeeds : fallbackFeeds;
    this.subscribeToFeeds(selectedFeeds);
  }

  async publishCommand(
    feed: string,
    value: unknown,
    optimisticSync = true,
  ): Promise<{ ok: boolean; topic: string; payload: string; note?: string }> {
    const normalizedFeed = this.canonicalizeActuatorFeedKey(
      this.requireFeedKey(feed),
    );

    if (value === undefined) {
      throw new BadRequestException('value la bat buoc khi publish command');
    }

    const topic = this.toTopic(normalizedFeed);
    const payload = this.toPayload(value);

    if (!(await this.isPublishFeedAllowed(normalizedFeed))) {
      const note =
        `Feed ${normalizedFeed} khong nam trong danh sach duoc phep publish. ` +
        'He thong chi publish data len feed da khai bao san, khong tu tao feed moi.';
      this.logger.warn(note);
      return {
        ok: false,
        topic,
        payload,
        note,
      };
    }

    // Check if this is a device control feed and if mode allows it
    if (this.isDeviceControlFeed(normalizedFeed)) {
      const mode = await this.modeControl.getCurrentMode();
      if (mode === 'auto') {
        const note =
          'Hệ thống đang chạy ở chế độ Auto. Không thể điều khiển thiết bị thủ công.';
        this.logger.warn(
          `publishCommand bị chặn (AUTO mode): ${normalizedFeed} = ${value}`,
        );
        return {
          ok: false,
          topic,
          payload,
          note,
        };
      }
    }

    const isLcdFeed =
      this.normalizeFeedKey(normalizedFeed) ===
      this.normalizeFeedKey(this.lcdFeedKey);

    if (
      isLcdFeed &&
      !this.publishingAutoLcd &&
      typeof value === 'string' &&
      value.trim()
    ) {
      this.lastOperatorLcdMessage = value.trim();
    }

    if (!this.client || !this.isConnected) {
      if (optimisticSync) {
        await this.saveState(normalizedFeed, topic, value, 'server-command');
      }

      await this.persistSensorLog({
        direction: 'outgoing',
        source: 'server-command',
        topic,
        feed: normalizedFeed,
        value,
        raw: payload,
      });

      const note =
        'MQTT client chua ket noi. Lenh da duoc luu state local, chua gui toi Adafruit.';
      this.logger.warn(`${note} Feed=${normalizedFeed}`);
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
      await this.saveState(normalizedFeed, topic, value, 'server-command');
    }

    await this.persistSensorLog({
      direction: 'outgoing',
      source: 'server-command',
      topic,
      feed: normalizedFeed,
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

    const normalizedFeed = this.requireFeedKey(feed);
    const topic = this.toTopic(normalizedFeed);
    const payload = Buffer.from(this.toPayload(value), 'utf8');
    await this.processIncomingTopic(topic, payload, 'server-simulate');

    return {
      ok: true,
      topic,
      feed: normalizedFeed,
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

  async getDeviceFeedState(deviceId: number): Promise<{
    deviceId: number;
    feeds: DeviceFeedState[];
  }> {
    // Load device với đầy đủ SensorChannels và ActuatorChannels
    const device = await this.prisma.device.findUnique({
      where: { deviceID: deviceId },
      select: {
        deviceID: true,
        mqttTopicSensor: true,
        metaData: true,
        sensorChannels: {
          orderBy: { sortOrder: 'asc' },
          select: {
            feedKey: true,
            sensorName: true,
            sensorType: true,
            unit: true,
            status: true,
          },
        },
        actuatorChannels: {
          orderBy: { sortOrder: 'asc' },
          select: {
            feedKey: true,
            actuatorName: true,
            actuatorType: true,
            status: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    const currentFeedState = new Map(
      this.getFeedState().map((item) => [
        this.normalizeFeedKey(item.feed),
        item,
      ]),
    );

    // Ưu tiên SensorChannels để xác định sensorType
    const sensorChannels: Array<{
      feedKey: string;
      sensorType: string | null;
    }> = Array.isArray(device.sensorChannels)
      ? (device.sensorChannels as Array<{
          feedKey: string;
          sensorType: string | null;
        }>)
      : [];
    const actuatorChannels: Array<{
      feedKey: string;
      actuatorType: string | null;
    }> = Array.isArray(device.actuatorChannels)
      ? (device.actuatorChannels as Array<{
          feedKey: string;
          actuatorType: string | null;
        }>)
      : [];
    const hasSensorChannels = sensorChannels.length > 0;
    const hasActuatorChannels = actuatorChannels.length > 0;

    const feeds: DeviceFeedState[] = [];

    if (hasSensorChannels) {
      for (const ch of sensorChannels) {
        const state = currentFeedState.get(this.normalizeFeedKey(ch.feedKey));
        feeds.push({
          feed: ch.feedKey,
          // Dùng sensorType từ channel metadata thay vì detect từ tên feed
          sensorType: ch.sensorType ?? this.detectSensorType(ch.feedKey),
          topic: state?.topic ?? null,
          value: state?.value,
          source: state?.source ?? null,
          updatedAt: state?.updatedAt ?? null,
        });
      }
    } else {
      // Backward compat: dùng mqttTopicSensor
      const configuredFeeds = this.extractDeviceFeeds(
        device.mqttTopicSensor,
        device.metaData,
      );
      for (const feed of configuredFeeds) {
        const state = currentFeedState.get(this.normalizeFeedKey(feed));
        feeds.push({
          feed,
          sensorType: this.detectSensorType(feed),
          topic: state?.topic ?? null,
          value: state?.value,
          source: state?.source ?? null,
          updatedAt: state?.updatedAt ?? null,
        });
      }
    }

    // Thêm actuator channels với sensorType = actuatorType
    if (hasActuatorChannels) {
      for (const ch of actuatorChannels) {
        const state = currentFeedState.get(this.normalizeFeedKey(ch.feedKey));
        feeds.push({
          feed: ch.feedKey,
          sensorType: ch.actuatorType ?? this.detectSensorType(ch.feedKey),
          topic: state?.topic ?? null,
          value: state?.value,
          source: state?.source ?? null,
          updatedAt: state?.updatedAt ?? null,
        });
      }
    }

    return {
      deviceId,
      feeds,
    };
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
    return [this.modeFeedKey]
      .map((item) => this.parseFeedKey(item))
      .filter((item): item is string => !!item);
  }

  private getFallbackSubscribeFeeds() {
    const fromEnv = this.configService.get<string>(
      'ADAFRUIT_IO_SUBSCRIBE_FEEDS',
    );
    if (!fromEnv) return [];

    return fromEnv
      .split(',')
      .map((item) => this.parseFeedKey(item))
      .filter((item): item is string => !!item);
  }

  private async getConfiguredFeedsFromDevices(): Promise<string[]> {
    const rows = await this.prisma.device.findMany({
      select: {
        mqttTopicSensor: true,
        metaData: true,
        // Include SensorChannels để subscribe đúng feed
        sensorChannels: { select: { feedKey: true } },
      },
    });

    const feeds = new Set<string>();

    for (const row of rows) {
      // Ưu tiên SensorChannels
      const sensorChannels: Array<{ feedKey: string }> = Array.isArray(
        row.sensorChannels,
      )
        ? (row.sensorChannels as Array<{ feedKey: string }>)
        : [];
      if (sensorChannels.length > 0) {
        for (const ch of sensorChannels) {
          if (ch.feedKey) feeds.add(ch.feedKey);
        }
      } else {
        // Backward compat
        const deviceFeeds = this.extractDeviceFeeds(
          row.mqttTopicSensor,
          row.metaData,
        );
        for (const feed of deviceFeeds) {
          feeds.add(feed);
        }
      }
    }

    return Array.from(feeds);
  }

  private getFallbackPublishFeeds() {
    const fromEnv = this.configService.get<string>('ADAFRUIT_IO_PUBLISH_FEEDS');
    if (!fromEnv) return [];

    return fromEnv
      .split(',')
      .map((item) => this.parseFeedKey(item))
      .filter((item): item is string => !!item);
  }

  private async getConfiguredCommandFeedsFromDevices(): Promise<string[]> {
    const rows = await this.prisma.device.findMany({
      select: {
        mqttTopicCmd: true,
        // Include ActuatorChannels để lấy command feeds đúng
        actuatorChannels: { select: { feedKey: true } },
      },
    });

    const feeds = new Set<string>();

    for (const row of rows) {
      // Ưu tiên ActuatorChannels
      const actuatorChannels: Array<{ feedKey: string }> = Array.isArray(
        row.actuatorChannels,
      )
        ? (row.actuatorChannels as Array<{ feedKey: string }>)
        : [];
      if (actuatorChannels.length > 0) {
        for (const ch of actuatorChannels) {
          if (ch.feedKey) feeds.add(ch.feedKey);
        }
      } else {
        // Backward compat: dùng mqttTopicCmd
        const commandFeeds = this.splitFeeds(row.mqttTopicCmd);
        for (const feed of commandFeeds) {
          feeds.add(feed);
        }
      }
    }

    return Array.from(feeds);
  }

  private isActuatorLikeFeed(feed: string): boolean {
    const normalized = this.normalizeFeedKey(feed);
    return (
      normalized.includes('fan') ||
      normalized.includes('led') ||
      normalized.includes('lcd') ||
      normalized.includes('heater') ||
      normalized.includes('humidifier') ||
      normalized.includes('doorlock')
    );
  }

  private async getConfiguredActuatorFeedsFromDevices(): Promise<string[]> {
    const rows = await this.prisma.device.findMany({
      select: {
        mqttTopicSensor: true,
        metaData: true,
      },
    });

    const feeds = new Set<string>();
    for (const row of rows) {
      const sensorFeeds = this.extractDeviceFeeds(
        row.mqttTopicSensor,
        row.metaData,
      );

      for (const feed of sensorFeeds) {
        if (this.isActuatorLikeFeed(feed)) {
          feeds.add(feed);
        }
      }
    }

    return Array.from(feeds);
  }

  private async refreshAllowedPublishFeeds(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.allowedPublishFeedsRefreshedAt < 30000) {
      return;
    }

    const [
      deviceCommandFeeds,
      deviceActuatorFeeds,
      extraPublishFeeds,
      setpointRows,
    ] = await Promise.all([
      this.getConfiguredCommandFeedsFromDevices(),
      this.getConfiguredActuatorFeedsFromDevices(),
      Promise.resolve(this.getFallbackPublishFeeds()),
      this.prisma.systemConfig.findMany({
        where: {
          configKey: {
            in: [
              'temperatureSetpointFeed',
              'humiditySetpointFeed',
              'operatingModeFeed',
            ],
          },
        },
        select: {
          configKey: true,
          configValue: true,
        },
      }),
    ]);

    const setpointByKey = new Map(
      setpointRows.map((row) => [
        row.configKey,
        String(row.configValue ?? '').trim(),
      ]),
    );

    const defaults = [
      this.modeFeedKey,
      this.lcdFeedKey,
      this.fanLevelFeedKey,
      this.ledFeedKey,
      setpointByKey.get('temperatureSetpointFeed') || '',
      setpointByKey.get('humiditySetpointFeed') || '',
      setpointByKey.get('operatingModeFeed') || this.modeFeedKey,
    ];

    const normalized = new Set<string>();

    const addAllowedFeed = (feed: string | null | undefined) => {
      const key = this.parseFeedKey(feed);
      if (!key) return;

      const lower = key.toLowerCase();
      const variants = new Set<string>([lower]);

      if (lower.startsWith('drytech.m-')) {
        variants.add(lower.replace(/^drytech\./, ''));
      }

      if (/^m-[a-z0-9-]+-/.test(lower)) {
        variants.add(`drytech.${lower}`);
      }

      for (const variant of variants) {
        normalized.add(this.normalizeFeedKey(variant));
      }
    };

    for (const feed of [
      ...defaults,
      ...deviceCommandFeeds,
      ...deviceActuatorFeeds,
      ...extraPublishFeeds,
    ]) {
      addAllowedFeed(feed);
    }

    this.allowedPublishFeeds = normalized;
    this.allowedPublishFeedsRefreshedAt = now;
  }

  private async isPublishFeedAllowed(feed: string): Promise<boolean> {
    await this.refreshAllowedPublishFeeds();
    return this.allowedPublishFeeds.has(this.normalizeFeedKey(feed));
  }

  /**
   * Check if a feed is a device control command feed (not a sensor data feed)
   * Device control feeds: fan_level, BBC_LED, led_state, etc.
   * Sensor feeds: temperature, humidity, light, device_status
   */
  private isDeviceControlFeed(feed: string): boolean {
    const controlFeeds = [
      'fan_level',
      'bbc_led',
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

  private detectSensorType(feed: string): string {
    const normalized = this.normalizeFeedKey(feed);
    if (normalized.includes('temperature') || normalized.includes('temp')) {
      return 'temperature';
    }
    if (normalized.includes('humidity') || normalized.includes('humid')) {
      return 'humidity';
    }
    if (normalized.includes('light') || normalized.includes('lux')) {
      return 'light';
    }
    if (normalized.includes('led')) {
      return 'led';
    }
    if (normalized.includes('fan')) {
      return 'fan';
    }
    if (normalized.includes('lcd')) {
      return 'lcd';
    }
    return 'custom';
  }

  private splitFeeds(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
      .split(/[\n,;]/)
      .map((feed) => this.parseFeedKey(feed))
      .filter((feed): feed is string => !!feed);
  }

  private parseFeedKey(feed: string | null | undefined): string | null {
    const raw = String(feed ?? '').trim();
    if (!raw) return null;

    const lower = raw.toLowerCase();
    const marker = '/feeds/';
    const markerIndex = lower.indexOf(marker);

    const key = markerIndex >= 0 ? raw.slice(markerIndex + marker.length) : raw;
    if (!key) return null;
    return key.trim();
  }

  private canonicalizeActuatorFeedKey(feed: string): string {
    const key = String(feed ?? '')
      .trim()
      .toLowerCase();
    if (!key) return key;

    if (key.startsWith('drytech.')) return key;

    const isMachineScoped = /^m-[a-z0-9-]+-/.test(key);
    const isActuatorKey = this.isActuatorLikeFeed(key);
    if (isMachineScoped && isActuatorKey) {
      return `drytech.${key}`;
    }

    return key;
  }

  private requireFeedKey(feed: string | null | undefined): string {
    const key = this.parseFeedKey(feed);
    if (!key) {
      throw new BadRequestException('feed khong hop le');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
      throw new BadRequestException(
        `feed khong hop le: ${feed}. Chi chap nhan ky tu a-z, A-Z, 0-9, ., _, -`,
      );
    }

    return key;
  }

  private extractDeviceFeeds(
    mqttTopicSensor: string | null,
    metaData: Prisma.JsonValue | null,
  ): string[] {
    const fromText = this.splitFeeds(mqttTopicSensor);

    if (!metaData || typeof metaData !== 'object' || Array.isArray(metaData)) {
      return Array.from(new Set(fromText));
    }

    const fromMeta = Array.isArray(
      (metaData as { sensorFeeds?: unknown }).sensorFeeds,
    )
      ? ((metaData as { sensorFeeds?: unknown }).sensorFeeds as unknown[])
          .map((feed) => String(feed ?? '').trim())
          .filter(Boolean)
      : [];

    return Array.from(new Set([...fromMeta, ...fromText]));
  }

  private toPayload(value: unknown) {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  private extractFeedFromTopic(topic: string) {
    const marker = '/feeds/';
    const lower = topic.toLowerCase();
    const markerIndex = lower.indexOf(marker);

    if (markerIndex >= 0) {
      return topic.slice(markerIndex + marker.length);
    }

    return topic;
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

    await this.evaluateDynamicFanRules(feed, value);

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
    const observation = this.sensorObservationAdapter.adapt(feed, value);
    const metric = observation.metric === 'custom' ? null : observation.metric;
    if (!metric || observation.numericValue === null) return;

    const sensorStrategy = this.sensorStrategyFactory.getStrategy(
      observation.metric,
    );
    if (sensorStrategy.shouldIgnore(observation)) return;

    const numericValue = observation.numericValue;

    this.metricState.set(metric, numericValue);

    const thresholds = await this.getThresholdConfig();
    const device = await this.resolveDeviceByFeed(feed);
    const deviceId = device?.deviceID ?? null;
    const deviceName = device?.deviceName || 'Thiết bị sấy';
    const formulaThreshold = await this.getFormulaThresholdConfig(deviceId);

    if (metric === 'temperature') {
      const isFaulty = await this.syncTemperatureSensorFaultStatus({
        feed,
        value: numericValue,
        deviceId,
        deviceName,
      });
      if (isFaulty) {
        return;
      }
    }

    if (metric === 'temperature') {
      const sensorFeedLabel = this.formatSensorFeedLabel(feed);

      await this.handleMetricAlert({
        conditionKey: `temp_high:${deviceId ?? 'global'}:${this.normalizeFeedKey(feed)}`,
        active: numericValue > thresholds.maxTempSafe,
        delaySeconds: thresholds.alertDelaySeconds,
        deviceId,
        alertType: 'error',
        alertMessage: `${deviceName}: Cảm biến ${sensorFeedLabel} vượt ngưỡng global (${thresholds.maxTempSafe}°C).`,
      });

      if (numericValue <= thresholds.maxTempSafe) {
        await this.resolveLegacyLocalProtectionAlerts(deviceId);
      }

      await this.handleMetricAlert({
        conditionKey: `temp_formula_high:${deviceId ?? 'global'}:${this.normalizeFeedKey(feed)}`,
        active:
          Number.isFinite(formulaThreshold.maxTemperature) &&
          numericValue >=
            (formulaThreshold.maxTemperature as number) +
              Math.max(0, thresholds.tempHysteresisDelta),
        delaySeconds: thresholds.alertDelaySeconds,
        deviceId,
        alertType: 'warning',
        alertMessage: this.buildFormulaTemperatureAlertMessage(
          deviceName,
          formulaThreshold,
          sensorFeedLabel,
        ),
      });

      if (numericValue > thresholds.maxTempSafe) {
        await this.applyLocalProtectionFanMax({
          deviceId,
          deviceName,
          sourceFeed: feed,
          currentTemperature: numericValue,
          maxTempSafe: thresholds.maxTempSafe,
        });
      }

      if (numericValue > thresholds.maxTempSafe) {
        await this.autoStopBatchWhenSystemThresholdExceeded({
          deviceId,
          deviceName,
          currentTemperature: numericValue,
          maxTempSafe: thresholds.maxTempSafe,
          autoStopEnabled: thresholds.autoStopEnabled,
          sourceFeed: feed,
        });
      }

      const hasDynamicRule =
        await this.hasEnabledDynamicRuleForSensorFeed(feed);
      if (!hasDynamicRule) {
        await this.applyAutoHysteresisFanControl({
          metric,
          sourceFeed: feed,
          deviceId,
          deviceName,
          currentValue: numericValue,
          formulaThreshold,
          thresholds,
        });
      }

      await this.applyAverageTemperatureHeaterControl({
        deviceId,
        deviceName,
        formulaThreshold,
        thresholds,
      });
      return;
    }

    if (metric === 'humidity') {
      const formulaHumidityMax = formulaThreshold.maxHumidity;
      const sensorFeedLabel = this.formatSensorFeedLabel(feed);

      await this.handleMetricAlert({
        conditionKey: `hum_low:${deviceId ?? 'global'}:${this.normalizeFeedKey(feed)}`,
        active: numericValue < thresholds.minHumidity,
        delaySeconds: thresholds.alertDelaySeconds,
        deviceId,
        alertType: 'warning',
        alertMessage: `${deviceName}: Cảm biến ${sensorFeedLabel} thấp hơn ngưỡng tối thiểu (${thresholds.minHumidity}%).`,
      });

      await this.handleMetricAlert({
        conditionKey: `hum_high:${deviceId ?? 'global'}:${this.normalizeFeedKey(feed)}`,
        active: numericValue > thresholds.maxHumidity,
        delaySeconds: thresholds.alertDelaySeconds,
        deviceId,
        alertType: 'warning',
        alertMessage: `${deviceName}: Cảm biến ${sensorFeedLabel} vượt ngưỡng global (${thresholds.maxHumidity}%).`,
      });

      await this.handleMetricAlert({
        conditionKey: `hum_formula_high:${deviceId ?? 'global'}:${this.normalizeFeedKey(feed)}`,
        active:
          Number.isFinite(formulaHumidityMax) &&
          numericValue >=
            (formulaHumidityMax as number) +
              Math.max(0, thresholds.humidityHysteresisDelta),
        delaySeconds: thresholds.alertDelaySeconds,
        deviceId,
        alertType: 'warning',
        alertMessage: this.buildFormulaHumidityAlertMessage(
          deviceName,
          formulaThreshold,
          sensorFeedLabel,
        ),
      });

      const hasDynamicRule =
        await this.hasEnabledDynamicRuleForSensorFeed(feed);
      if (!hasDynamicRule) {
        await this.applyAutoHysteresisFanControl({
          metric,
          sourceFeed: feed,
          deviceId,
          deviceName,
          currentValue: numericValue,
          formulaThreshold,
          thresholds,
        });
      }
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
    const metric = resolveSensorMetric(feed);

    if (metric === 'temperature') {
      return 'temperature';
    }

    if (metric === 'humidity') {
      return 'humidity';
    }

    if (metric === 'light') {
      return 'light';
    }

    return null;
  }

  private async getThresholdConfig(): Promise<ThresholdConfig> {
    const targetKeys = [
      'maxTempSafe',
      'minHumidity',
      'maxHumidity',
      'tempHysteresisDelta',
      'humidityHysteresisDelta',
      'autoFanLevelOn',
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

    const asNumber = (key: string, fallback: number): number => {
      const raw = byKey.get(key);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const autoFanLevelOn = Math.max(
      1,
      Math.min(
        100,
        Math.round(
          asNumber('autoFanLevelOn', DEFAULT_THRESHOLDS.autoFanLevelOn),
        ),
      ),
    );

    return {
      maxTempSafe: asNumber('maxTempSafe', DEFAULT_THRESHOLDS.maxTempSafe),
      minHumidity: asNumber('minHumidity', DEFAULT_THRESHOLDS.minHumidity),
      maxHumidity: asNumber('maxHumidity', DEFAULT_THRESHOLDS.maxHumidity),
      tempHysteresisDelta: asNumber(
        'tempHysteresisDelta',
        DEFAULT_THRESHOLDS.tempHysteresisDelta,
      ),
      humidityHysteresisDelta: asNumber(
        'humidityHysteresisDelta',
        DEFAULT_THRESHOLDS.humidityHysteresisDelta,
      ),
      autoFanLevelOn,
      autoStopEnabled:
        String(
          byKey.get('autoStopEnabled') ??
            String(DEFAULT_THRESHOLDS.autoStopEnabled),
        ) === 'true',
      alertDelaySeconds: asNumber(
        'alertDelaySeconds',
        DEFAULT_THRESHOLDS.alertDelaySeconds,
      ),
      lightSensorThreshold: asNumber(
        'lightSensorThreshold',
        DEFAULT_THRESHOLDS.lightSensorThreshold,
      ),
      doorOpenTimeout: asNumber(
        'doorOpenTimeout',
        DEFAULT_THRESHOLDS.doorOpenTimeout,
      ),
    };
  }

  private async getDynamicFanRules(
    force = false,
  ): Promise<DynamicFanRuleConfig[]> {
    const now = Date.now();
    if (!force && now - this.dynamicFanRulesCachedAt < 5000) {
      return this.dynamicFanRulesCache;
    }

    const rows = await this.prisma.systemConfig.findMany({
      where: {
        configKey: {
          startsWith: 'operatorFanRules.',
        },
      },
      select: {
        configKey: true,
        configValue: true,
      },
    });

    const parsedRules: DynamicFanRuleConfig[] = [];

    for (const row of rows) {
      const raw = String(row.configValue ?? '').trim();
      if (!raw) continue;

      let payload: unknown;
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        continue;
      }

      if (!Array.isArray(payload)) continue;

      for (let index = 0; index < payload.length; index += 1) {
        const item = payload[index];
        if (!item || typeof item !== 'object') continue;

        const candidate = item as Partial<DynamicFanRuleConfig>;
        const sensorFeed = this.parseFeedKey(
          String(candidate.sensorFeed ?? '').trim(),
        );
        const fanFeed = this.parseFeedKey(
          String(candidate.fanFeed ?? '').trim(),
        );
        if (!sensorFeed || !fanFeed) continue;

        const threshold = Number(candidate.threshold);
        const fanLevelOn = Number(candidate.fanLevelOn);
        const fanLevelOff = Number(candidate.fanLevelOff);
        const priority = Number(candidate.priority);
        const cooldownMs = Number(
          (candidate as { cooldownMs?: unknown }).cooldownMs,
        );
        const categoryRaw = String(
          (candidate as { category?: unknown }).category ?? 'normal',
        ).toLowerCase();

        parsedRules.push({
          id: String(candidate.id ?? `${row.configKey}#${index + 1}`),
          enabled: Boolean(candidate.enabled),
          sensorFeed,
          comparator: candidate.comparator === 'lte' ? 'lte' : 'gte',
          threshold: Number.isFinite(threshold) ? threshold : 0,
          fanFeed: this.canonicalizeActuatorFeedKey(fanFeed),
          fanLevelOn: Number.isFinite(fanLevelOn)
            ? Math.max(0, Math.min(100, Math.round(fanLevelOn)))
            : 70,
          fanLevelOff: Number.isFinite(fanLevelOff)
            ? Math.max(0, Math.min(100, Math.round(fanLevelOff)))
            : 0,
          priority: Number.isFinite(priority)
            ? Math.max(0, Math.round(priority))
            : 200,
          cooldownMs: Number.isFinite(cooldownMs)
            ? Math.max(0, Math.round(cooldownMs))
            : 0,
          category: categoryRaw === 'critical' ? 'critical' : 'normal',
          configKey: row.configKey,
        });
      }
    }

    this.dynamicFanRulesCache = parsedRules;
    this.dynamicFanRulesCachedAt = now;
    return parsedRules;
  }

  private parseGroupCondition(value: unknown): DynamicFanGroupCondition | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as {
      sensorFeed?: unknown;
      comparator?: unknown;
      threshold?: unknown;
    };

    const sensorFeed = this.parseFeedKey(
      String(candidate.sensorFeed ?? '').trim(),
    );
    if (!sensorFeed) return null;

    const threshold = Number(candidate.threshold);
    if (!Number.isFinite(threshold)) return null;

    return {
      sensorFeed,
      comparator: candidate.comparator === 'lte' ? 'lte' : 'gte',
      threshold,
    };
  }

  private parseGroupOutput(value: unknown): DynamicFanGroupOutput | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as {
      fanFeed?: unknown;
      fanLevelOn?: unknown;
      fanLevelOff?: unknown;
    };

    const fanFeed = this.parseFeedKey(String(candidate.fanFeed ?? '').trim());
    if (!fanFeed) return null;

    const fanLevelOn = Number(candidate.fanLevelOn);
    const fanLevelOff = Number(candidate.fanLevelOff);

    return {
      fanFeed: this.canonicalizeActuatorFeedKey(fanFeed),
      fanLevelOn: Number.isFinite(fanLevelOn)
        ? Math.max(0, Math.min(100, Math.round(fanLevelOn)))
        : 70,
      fanLevelOff: Number.isFinite(fanLevelOff)
        ? Math.max(0, Math.min(100, Math.round(fanLevelOff)))
        : 0,
    };
  }

  private async getDynamicFanGroups(
    force = false,
  ): Promise<DynamicFanGroupRuleConfig[]> {
    const now = Date.now();
    if (!force && now - this.dynamicFanGroupsCachedAt < 5000) {
      return this.dynamicFanGroupsCache;
    }

    const rows = await this.prisma.systemConfig.findMany({
      where: {
        configKey: {
          startsWith: 'operatorFanRuleGroups.',
        },
      },
      select: {
        configKey: true,
        configValue: true,
      },
    });

    const parsedGroups: DynamicFanGroupRuleConfig[] = [];

    for (const row of rows) {
      const raw = String(row.configValue ?? '').trim();
      if (!raw) continue;

      let payload: unknown;
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        continue;
      }

      if (!Array.isArray(payload)) continue;

      for (let index = 0; index < payload.length; index += 1) {
        const item = payload[index];
        if (!item || typeof item !== 'object') continue;

        const candidate = item as {
          id?: unknown;
          enabled?: unknown;
          operator?: unknown;
          conditions?: unknown;
          outputs?: unknown;
          priority?: unknown;
          cooldownMs?: unknown;
        };

        const conditions = Array.isArray(candidate.conditions)
          ? candidate.conditions
              .map((entry) => this.parseGroupCondition(entry))
              .filter((entry): entry is DynamicFanGroupCondition => !!entry)
          : [];
        if (conditions.length === 0) continue;

        const outputs = Array.isArray(candidate.outputs)
          ? candidate.outputs
              .map((entry) => this.parseGroupOutput(entry))
              .filter((entry): entry is DynamicFanGroupOutput => !!entry)
          : [];
        if (outputs.length === 0) continue;

        const priority = Number(candidate.priority);
        const cooldownMs = Number(candidate.cooldownMs);

        parsedGroups.push({
          id: String(candidate.id ?? `${row.configKey}#${index + 1}`),
          enabled: Boolean(candidate.enabled),
          operator:
            String(candidate.operator ?? 'OR').toUpperCase() === 'AND'
              ? 'AND'
              : 'OR',
          conditions,
          outputs,
          priority: Number.isFinite(priority)
            ? Math.max(0, Math.round(priority))
            : 100,
          cooldownMs: Number.isFinite(cooldownMs)
            ? Math.max(0, Math.round(cooldownMs))
            : 0,
          configKey: row.configKey,
        });
      }
    }

    this.dynamicFanGroupsCache = parsedGroups;
    this.dynamicFanGroupsCachedAt = now;
    return parsedGroups;
  }

  private async getDynamicFanConflictConfig(
    force = false,
  ): Promise<DynamicFanConflictConfig> {
    const now = Date.now();
    if (!force && now - this.dynamicFanConflictCachedAt < 5000) {
      return this.dynamicFanConflictCache;
    }

    const rows = await this.prisma.systemConfig.findMany({
      where: {
        configKey: {
          in: [
            'operatorFanRuleConflict.defaultCooldownMs',
            'operatorFanRuleConflict.allowEqualPriorityTakeover',
          ],
        },
      },
      select: {
        configKey: true,
        configValue: true,
      },
    });

    const byKey = new Map<string, string>();
    for (const row of rows) {
      byKey.set(row.configKey, row.configValue ?? '');
    }

    const defaultCooldownMs = Number(
      byKey.get('operatorFanRuleConflict.defaultCooldownMs') ?? '5000',
    );
    const allowEqualPriorityTakeover =
      String(
        byKey.get('operatorFanRuleConflict.allowEqualPriorityTakeover') ??
          'false',
      ) === 'true';

    const config: DynamicFanConflictConfig = {
      defaultCooldownMs: Number.isFinite(defaultCooldownMs)
        ? Math.max(0, Math.round(defaultCooldownMs))
        : 5000,
      allowEqualPriorityTakeover,
    };

    this.dynamicFanConflictCache = config;
    this.dynamicFanConflictCachedAt = now;
    return config;
  }

  private async hasEnabledDynamicRuleForSensorFeed(
    feed: string,
  ): Promise<boolean> {
    const normalizedFeed = this.normalizeFeedKey(feed);
    const [rules, groups] = await Promise.all([
      this.getDynamicFanRules(),
      this.getDynamicFanGroups(),
    ]);

    const hasAtom = rules.some(
      (rule) =>
        rule.enabled &&
        this.normalizeFeedKey(rule.sensorFeed) === normalizedFeed,
    );

    if (hasAtom) return true;

    return groups.some(
      (group) =>
        group.enabled &&
        group.conditions.some(
          (condition) =>
            this.normalizeFeedKey(condition.sensorFeed) === normalizedFeed,
        ),
    );
  }

  private findLatestFeedValue(feed: string): number | null {
    const normalizedTarget = this.normalizeFeedKey(feed);
    const matched = Array.from(this.feedState.values()).find(
      (row) => this.normalizeFeedKey(row.feed) === normalizedTarget,
    );
    if (!matched) return null;

    const numeric = Number(matched.value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private isFaultTemperatureReading(value: number): boolean {
    return value < SENSOR_FAULT_TEMP_MIN || value > SENSOR_FAULT_TEMP_MAX;
  }

  private isTemperatureFeedMarkedFaulty(feed: string): boolean {
    return this.faultyTemperatureFeeds.has(this.normalizeFeedKey(feed));
  }

  private async syncTemperatureSensorFaultStatus(params: {
    feed: string;
    value: number;
    deviceId: number | null;
    deviceName: string;
  }): Promise<boolean> {
    const { feed, value, deviceId, deviceName } = params;
    const normalizedFeed = this.normalizeFeedKey(feed);
    const alertMessage = `${deviceName}: Cảm biến nhiệt ${feed} cho giá trị bất thường (${value}°C, hợp lệ ${SENSOR_FAULT_TEMP_MIN}-${SENSOR_FAULT_TEMP_MAX}°C). Đã loại khỏi trung bình và yêu cầu kiểm tra bảo trì.`;
    const isFault = this.isFaultTemperatureReading(value);

    if (isFault) {
      if (!this.faultyTemperatureFeeds.has(normalizedFeed)) {
        this.faultyTemperatureFeeds.add(normalizedFeed);
        await this.createPendingAlertIfNeeded(
          deviceId,
          'warning',
          alertMessage,
        );
      }
      return true;
    }

    if (this.faultyTemperatureFeeds.has(normalizedFeed)) {
      this.faultyTemperatureFeeds.delete(normalizedFeed);
      await this.resolveOpenAlertsByMessage(deviceId, alertMessage);
    }

    return false;
  }

  private async applyLocalProtectionFanMax(params: {
    deviceId: number | null;
    deviceName: string;
    sourceFeed: string;
    currentTemperature: number;
    maxTempSafe: number;
  }): Promise<void> {
    const fanFeed = await this.resolveControlFeed(params.deviceId, 'fan');
    if (!fanFeed) return;

    const currentFanLevel = this.findLatestFeedValue(fanFeed);
    if (currentFanLevel === null || Math.round(currentFanLevel) < 100) {
      await this.publishServerControl(fanFeed, 100);
      this.tempHysteresisFanState.set(
        `${params.deviceId ?? 'global'}:${fanFeed}`,
        true,
      );
    }

    const heaterFeed = await this.resolveControlFeed(params.deviceId, 'heater');
    if (heaterFeed) {
      const heaterLevel = this.findLatestFeedValue(heaterFeed);
      if (heaterLevel === null || Math.round(heaterLevel) > 0) {
        await this.publishServerControl(heaterFeed, 0);
        this.heaterHysteresisState.set(
          `${params.deviceId ?? 'global'}:${heaterFeed}`,
          false,
        );
      }
    }

    this.logger.warn(
      `${params.deviceName}: Bảo vệ cục bộ kích hoat tai ${params.sourceFeed} (${params.currentTemperature}°C > ${params.maxTempSafe}°C). Da gui lenh ep quat 100% va tat gia nhiet.`,
    );
  }

  private async collectHealthyDeviceTemperatureValues(
    deviceId: number | null,
  ): Promise<number[]> {
    const queryDevice = async (targetDeviceId: number | null) =>
      this.prisma.device.findMany({
        where: targetDeviceId ? { deviceID: targetDeviceId } : undefined,
        select: {
          mqttTopicSensor: true,
          metaData: true,
        },
      });

    let rows = await queryDevice(deviceId);
    if (rows.length === 0 && deviceId) {
      rows = await queryDevice(null);
    }

    const temperatureFeeds = new Set<string>();
    for (const row of rows) {
      const feeds = this.extractDeviceFeeds(row.mqttTopicSensor, row.metaData);
      for (const feed of feeds) {
        const metric = this.detectMetric(feed);
        if (metric !== 'temperature') continue;
        if (this.isActuatorLikeFeed(feed)) continue;
        temperatureFeeds.add(feed);
      }
    }

    const values: number[] = [];
    for (const feed of temperatureFeeds) {
      if (this.isTemperatureFeedMarkedFaulty(feed)) continue;
      const current = this.findLatestFeedValue(feed);
      if (!Number.isFinite(current)) continue;
      if (this.isFaultTemperatureReading(current as number)) continue;
      values.push(current as number);
    }

    return values;
  }

  private async applyAverageTemperatureHeaterControl(params: {
    deviceId: number | null;
    deviceName: string;
    formulaThreshold: FormulaThresholdConfig;
    thresholds: ThresholdConfig;
  }): Promise<void> {
    const mode = await this.modeControl.getCurrentMode();
    if (mode !== 'auto') return;

    const setpoint = Number(params.formulaThreshold.maxTemperature);
    if (!Number.isFinite(setpoint)) return;

    const heaterFeed = await this.resolveControlFeed(params.deviceId, 'heater');
    if (!heaterFeed) return;

    const values = await this.collectHealthyDeviceTemperatureValues(
      params.deviceId,
    );
    if (values.length === 0) return;

    const averageTemperature =
      values.reduce((sum, item) => sum + item, 0) / values.length;
    const delta = Math.max(0.5, params.thresholds.tempHysteresisDelta);

    const stateKey = `${params.deviceId ?? 'global'}:${heaterFeed}`;
    const currentHeaterLevel = this.findLatestFeedValue(heaterFeed);
    const heaterOn = this.heaterHysteresisState.has(stateKey)
      ? (this.heaterHysteresisState.get(stateKey) as boolean)
      : Number.isFinite(currentHeaterLevel) &&
        (currentHeaterLevel as number) > 0;

    const shouldTurnOn = !heaterOn && averageTemperature < setpoint - delta;
    const shouldTurnOff = heaterOn && averageTemperature > setpoint + delta;

    if (!shouldTurnOn && !shouldTurnOff) {
      this.heaterHysteresisState.set(stateKey, heaterOn);
      return;
    }

    const nextValue = shouldTurnOn ? 1 : 0;
    await this.publishServerControl(heaterFeed, nextValue);
    this.heaterHysteresisState.set(stateKey, nextValue > 0);

    this.logger.log(
      `${params.deviceName}: Auto heater ${nextValue > 0 ? 'ON' : 'OFF'} theo trung bình nhiệt độ khỏe (${averageTemperature.toFixed(2)}°C, setpoint=${setpoint}°C, delta=${delta}°C, feed=${heaterFeed}).`,
    );
  }

  private async evaluateDynamicFanRules(
    feed: string,
    value: unknown,
  ): Promise<void> {
    const observation = this.sensorObservationAdapter.adapt(feed, value);
    if (observation.numericValue === null) return;

    const sensorStrategy = this.sensorStrategyFactory.getStrategy(
      observation.metric,
    );
    if (sensorStrategy.shouldIgnore(observation)) return;

    const metric = observation.metric === 'custom' ? null : observation.metric;
    if (
      metric === 'temperature' &&
      (this.isFaultTemperatureReading(observation.numericValue) ||
        this.isTemperatureFeedMarkedFaulty(feed))
    ) {
      return;
    }

    const [atomRules, groupRules, conflictConfig] = await Promise.all([
      this.getDynamicFanRules(),
      this.getDynamicFanGroups(),
      this.getDynamicFanConflictConfig(),
    ]);

    if (atomRules.length === 0 && groupRules.length === 0) return;

    const matchedActions: ResolvedFanAction[] = [];

    for (const rule of atomRules) {
      if (!rule.enabled) continue;
      if (
        normalizePatternFeedKey(rule.sensorFeed) !== observation.normalizedFeed
      ) {
        continue;
      }

      const targetLevel = this.atomRuleSpecification.isSatisfied(
        rule as DynamicFanRuleLike,
        observation,
      )
        ? rule.fanLevelOn
        : this.atomRuleSpecification.resolveFallbackLevel(
            rule as DynamicFanRuleLike,
          );

      matchedActions.push({
        ruleId: rule.id,
        fanFeed: rule.fanFeed,
        targetLevel,
        priority: rule.priority,
        cooldownMs: rule.cooldownMs,
      });
    }

    for (const group of groupRules) {
      const isMatched = this.groupRuleSpecification.isSatisfied(
        group as DynamicFanGroupRuleLike,
        observation,
        (sensorFeed) => this.findLatestFeedValue(sensorFeed),
        (sensorFeed, numericValue) =>
          this.detectMetric(sensorFeed) === 'temperature' &&
          (this.isFaultTemperatureReading(numericValue) ||
            this.isTemperatureFeedMarkedFaulty(sensorFeed)),
      );

      if (!isMatched) {
        continue;
      }

      for (const candidate of this.groupRuleSpecification.toCandidates(
        group as DynamicFanGroupRuleLike,
        true,
      )) {
        matchedActions.push(candidate);
      }
    }

    if (matchedActions.length === 0) return;

    const selectedByFeed = new Map<string, ResolvedFanAction>();
    for (const action of matchedActions) {
      const key = this.normalizeFeedKey(action.fanFeed);
      const current = selectedByFeed.get(key);
      if (!current) {
        selectedByFeed.set(key, action);
        continue;
      }

      if (action.priority > current.priority) {
        selectedByFeed.set(key, action);
      }
    }

    const now = Date.now();
    for (const selected of selectedByFeed.values()) {
      const stateKey = this.normalizeFeedKey(selected.fanFeed);
      const previous = this.fanRuleResolutionState.get(stateKey);
      const effectiveCooldown = Math.max(
        selected.cooldownMs,
        conflictConfig.defaultCooldownMs,
      );

      if (previous) {
        const withinCooldown = now - previous.appliedAt < effectiveCooldown;
        const lowerPriority = selected.priority < previous.priority;
        const equalPriority = selected.priority === previous.priority;
        const blockedEqualPriorityChange =
          equalPriority &&
          selected.ruleId !== previous.ruleId &&
          selected.targetLevel !== previous.value &&
          !conflictConfig.allowEqualPriorityTakeover;

        // Controlled last-writer-wins: only allow replacing equal-priority writer when policy allows.
        if (
          (withinCooldown && lowerPriority) ||
          (withinCooldown && blockedEqualPriorityChange)
        ) {
          continue;
        }
      }

      const currentLevel = this.findLatestFeedValue(selected.fanFeed);
      if (
        currentLevel !== null &&
        Math.round(currentLevel) === selected.targetLevel
      ) {
        this.fanRuleResolutionState.set(stateKey, {
          ruleId: selected.ruleId,
          priority: selected.priority,
          value: selected.targetLevel,
          appliedAt: now,
        });
        continue;
      }

      await this.publishServerControl(selected.fanFeed, selected.targetLevel);
      this.fanRuleResolutionState.set(stateKey, {
        ruleId: selected.ruleId,
        priority: selected.priority,
        value: selected.targetLevel,
        appliedAt: now,
      });

      this.logger.log(
        `Dynamic fan resolver applied: rule=${selected.ruleId} feed=${selected.fanFeed} level=${selected.targetLevel} priority=${selected.priority} cooldownMs=${effectiveCooldown}`,
      );
    }
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

  private async getFormulaThresholdConfig(
    deviceId: number | null,
  ): Promise<FormulaThresholdConfig> {
    const queryActiveBatch = (targetDeviceId: number | null) =>
      this.prisma.batch.findFirst({
        where: {
          ...(targetDeviceId ? { deviceID: targetDeviceId } : {}),
          batchStatus: {
            in: ['Running', 'InProgress', 'Active', 'Processing'],
          },
        },
        select: {
          currentStage: true,
          currentStep: true,
          recipe: {
            select: {
              recipeName: true,
              recipeFruits: true,
              stages: {
                select: {
                  stageOrder: true,
                  temperatureSetpoint: true,
                  humiditySetpoint: true,
                },
                orderBy: { stageOrder: 'asc' },
              },
              steps: {
                select: {
                  stepNo: true,
                  temperatureGoal: true,
                  humidityGoal: true,
                },
                orderBy: { stepNo: 'asc' },
              },
            },
          },
        },
        orderBy: { batchesID: 'desc' },
      });

    // In shared-feed mode, metric feed may not map to the exact device.
    // Fallback to the newest running batch globally to keep formula control active.
    let activeBatch = await queryActiveBatch(deviceId);
    if (!activeBatch && deviceId) {
      activeBatch = await queryActiveBatch(null);
    }

    if (!activeBatch?.recipe) {
      return {
        maxTemperature: null,
        maxHumidity: null,
        recipeName: null,
        fruitType: null,
        source: 'none',
      };
    }

    const stageOrder = activeBatch.currentStage ?? 1;
    const matchedStage =
      activeBatch.recipe.stages.find(
        (stage) => stage.stageOrder === stageOrder,
      ) ?? activeBatch.recipe.stages[0];

    // Backward compatibility for old recipes/batches that only have steps/currentStep.
    const stepNo = activeBatch.currentStep ?? 1;
    const matchedStep =
      activeBatch.recipe.steps.find((step) => step.stepNo === stepNo) ??
      activeBatch.recipe.steps[0];

    return resolveFormulaThreshold({
      recipeName: activeBatch.recipe.recipeName,
      recipeFruits: activeBatch.recipe.recipeFruits,
      stepTemperatureGoal:
        matchedStage?.temperatureSetpoint ?? matchedStep?.temperatureGoal,
      stepHumidityGoal:
        matchedStage?.humiditySetpoint ?? matchedStep?.humidityGoal,
    });
  }

  private pickCommandFeedByTokens(
    feeds: string[],
    tokens: string[],
  ): string | null {
    for (const feed of feeds) {
      const normalized = this.normalizeFeedKey(feed);
      if (tokens.some((token) => normalized.includes(token))) {
        return feed;
      }
    }
    return null;
  }

  private async resolveControlFeed(
    deviceId: number | null,
    controlType: 'fan' | 'led' | 'heater',
  ): Promise<string | null> {
    const fallbackRaw =
      controlType === 'fan'
        ? this.parseFeedKey(this.fanLevelFeedKey)
        : controlType === 'led'
          ? this.parseFeedKey(this.ledFeedKey)
          : null;
    const fallback = fallbackRaw
      ? this.canonicalizeActuatorFeedKey(fallbackRaw)
      : null;

    if (!deviceId) {
      return fallback;
    }

    const row = await this.prisma.device.findUnique({
      where: { deviceID: deviceId },
      select: { mqttTopicCmd: true, mqttTopicSensor: true, metaData: true },
    });

    const commandFeeds = this.splitFeeds(row?.mqttTopicCmd ?? null);
    const sensorFeeds = this.extractDeviceFeeds(
      row?.mqttTopicSensor ?? null,
      row?.metaData ?? null,
    ).filter((feed) => this.isActuatorLikeFeed(feed));
    const candidateFeeds = Array.from(
      new Set([...commandFeeds, ...sensorFeeds]),
    );

    if (candidateFeeds.length === 0) return fallback;

    if (controlType === 'fan') {
      const selected =
        this.pickCommandFeedByTokens(candidateFeeds, ['fanlevel', 'fan']) ||
        fallback;
      return selected ? this.canonicalizeActuatorFeedKey(selected) : null;
    }

    if (controlType === 'heater') {
      const selected =
        this.pickCommandFeedByTokens(candidateFeeds, ['heater', 'heat']) ||
        fallback;
      return selected ? this.canonicalizeActuatorFeedKey(selected) : null;
    }

    const selected =
      this.pickCommandFeedByTokens(candidateFeeds, ['led']) || fallback;
    return selected ? this.canonicalizeActuatorFeedKey(selected) : null;
  }

  private async publishServerControl(
    feed: string,
    value: number,
  ): Promise<void> {
    const normalizedFeed = this.canonicalizeActuatorFeedKey(
      this.requireFeedKey(feed),
    );

    if (!(await this.isPublishFeedAllowed(normalizedFeed))) {
      this.logger.warn(
        `Bo qua publishServerControl cho feed ${normalizedFeed} vi feed nay khong duoc phep publish.`,
      );
      return;
    }

    const topic = this.toTopic(normalizedFeed);
    await this.saveState(normalizedFeed, topic, value, 'server-command');

    await this.persistSensorLog({
      direction: 'outgoing',
      source: 'server-command',
      topic,
      feed: normalizedFeed,
      value,
      raw: String(value),
    });

    if (!this.client || !this.isConnected) return;

    await new Promise<void>((resolve, reject) => {
      this.client?.publish(
        topic,
        String(value),
        { qos: 0, retain: false },
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        },
      );
    });
  }

  private async applyAutoHysteresisFanControl(params: {
    metric: 'temperature' | 'humidity';
    sourceFeed: string;
    deviceId: number | null;
    deviceName: string;
    currentValue: number;
    formulaThreshold: FormulaThresholdConfig;
    thresholds: ThresholdConfig;
  }): Promise<void> {
    const mode = await this.modeControl.getCurrentMode();
    if (mode !== 'auto') return;

    const tempBaseThreshold = Number.isFinite(
      params.formulaThreshold.maxTemperature,
    )
      ? Math.min(
          params.thresholds.maxTempSafe,
          params.formulaThreshold.maxTemperature as number,
        )
      : params.thresholds.maxTempSafe;
    const humBaseThreshold = Number.isFinite(
      params.formulaThreshold.maxHumidity,
    )
      ? Math.min(
          params.thresholds.maxHumidity,
          params.formulaThreshold.maxHumidity as number,
        )
      : params.thresholds.maxHumidity;

    const tempDelta = Math.max(0, params.thresholds.tempHysteresisDelta);
    const humDelta = Math.max(0, params.thresholds.humidityHysteresisDelta);
    const fanFeed = await this.resolveControlFeed(params.deviceId, 'fan');
    if (!fanFeed) {
      this.logger.warn(
        `${params.deviceName}: Bo qua auto dieu khien quat vi chua cau hinh fan feed.`,
      );
      return;
    }

    const key = `${params.deviceId ?? 'global'}:${fanFeed}`;
    const currentFanLevel = Number(this.feedState.get(fanFeed)?.value);

    const currentTemperature =
      params.metric === 'temperature'
        ? params.currentValue
        : this.metricState.get('temperature');
    const currentHumidity =
      params.metric === 'humidity'
        ? params.currentValue
        : this.metricState.get('humidity');

    const fanRunning = this.tempHysteresisFanState.has(key)
      ? (this.tempHysteresisFanState.get(key) as boolean)
      : Number.isFinite(currentFanLevel) && currentFanLevel > 0;

    const tempTriggerOn =
      Number.isFinite(currentTemperature) &&
      (currentTemperature as number) >= tempBaseThreshold + tempDelta;
    const humTriggerOn =
      Number.isFinite(currentHumidity) &&
      (currentHumidity as number) >= humBaseThreshold + humDelta;

    const tempSafeToOff =
      !Number.isFinite(currentTemperature) ||
      (currentTemperature as number) <= tempBaseThreshold;
    const humSafeToOff =
      !Number.isFinite(currentHumidity) ||
      (currentHumidity as number) <= humBaseThreshold;

    const shouldTurnOn = !fanRunning && (tempTriggerOn || humTriggerOn);
    const shouldTurnOff = fanRunning && tempSafeToOff && humSafeToOff;

    if (!shouldTurnOn && !shouldTurnOff) {
      this.tempHysteresisFanState.set(key, fanRunning);
      return;
    }

    const autoOnLevel = Math.max(
      1,
      Math.min(100, params.thresholds.autoFanLevelOn),
    );
    const nextLevel = shouldTurnOn ? autoOnLevel : 0;
    await this.publishServerControl(fanFeed, nextLevel);
    this.tempHysteresisFanState.set(key, nextLevel > 0);

    const action = shouldTurnOn ? 'BAT' : 'TAT';
    this.logger.log(
      `${params.deviceName}: Auto ${action} quat theo hysteresis, T=${Number.isFinite(currentTemperature) ? `${currentTemperature}°C` : 'N/A'}, H=${Number.isFinite(currentHumidity) ? `${currentHumidity}%` : 'N/A'}, tempBase=${tempBaseThreshold}°C, tempDelta=${tempDelta}°C, humBase=${humBaseThreshold}%, humDelta=${humDelta}%, feed=${fanFeed}, level=${nextLevel}`,
    );
  }

  private buildFormulaHumidityAlertMessage(
    deviceName: string,
    formula: FormulaThresholdConfig,
    sensorFeedLabel?: string,
  ): string {
    const thresholdText = Number.isFinite(formula.maxHumidity)
      ? `${formula.maxHumidity}%`
      : 'ngưỡng công thức';
    const feedText = sensorFeedLabel ? ` ${sensorFeedLabel}` : '';

    if (formula.recipeName) {
      return `${deviceName}: Cảm biến${feedText} vượt ngưỡng công thức (${formula.recipeName}, cần < ${thresholdText}).`;
    }

    if (formula.fruitType) {
      return `${deviceName}: Cảm biến${feedText} vượt ngưỡng công thức cho ${formula.fruitType} (cần < ${thresholdText}).`;
    }

    return `${deviceName}: Cảm biến${feedText} vượt ngưỡng công thức (cần < ${thresholdText}).`;
  }

  private buildFormulaTemperatureAlertMessage(
    deviceName: string,
    formula: FormulaThresholdConfig,
    sensorFeedLabel?: string,
  ): string {
    const thresholdText = Number.isFinite(formula.maxTemperature)
      ? `${formula.maxTemperature}°C`
      : 'ngưỡng công thức';
    const feedText = sensorFeedLabel ? ` ${sensorFeedLabel}` : '';

    if (formula.recipeName) {
      return `${deviceName}: Cảm biến${feedText} vượt ngưỡng công thức (${formula.recipeName}, > ${thresholdText}).`;
    }

    if (formula.fruitType) {
      return `${deviceName}: Cảm biến${feedText} vượt ngưỡng công thức cho ${formula.fruitType} (> ${thresholdText}).`;
    }

    return `${deviceName}: Cảm biến${feedText} vượt ngưỡng công thức (> ${thresholdText}).`;
  }

  private async autoStopBatchWhenSystemThresholdExceeded(params: {
    deviceId: number | null;
    deviceName: string;
    currentTemperature: number;
    maxTempSafe: number;
    autoStopEnabled: boolean;
    sourceFeed: string;
  }): Promise<void> {
    if (!params.autoStopEnabled) return;

    const runningBatch = await this.prisma.batch.findFirst({
      where: {
        ...(params.deviceId ? { deviceID: params.deviceId } : {}),
        batchStatus: {
          in: ['Running', 'InProgress', 'Active', 'Processing'],
        },
      },
      select: {
        batchesID: true,
      },
      orderBy: { batchesID: 'desc' },
    });

    if (!runningBatch) return;

    await this.prisma.$transaction([
      this.prisma.batch.update({
        where: { batchesID: runningBatch.batchesID },
        data: {
          batchStatus: 'Stopped',
          batchResult: 'SystemThresholdExceeded',
        },
      }),
      this.prisma.batchOperation.updateMany({
        where: {
          batchesID: runningBatch.batchesID,
          endedAt: null,
        },
        data: {
          endedAt: new Date(),
        },
      }),
    ]);

    const [fanFeed, ledFeed] = await Promise.all([
      this.resolveControlFeed(params.deviceId, 'fan'),
      this.resolveControlFeed(params.deviceId, 'led'),
    ]);

    const stopCommands: Promise<void>[] = [];
    if (fanFeed) {
      stopCommands.push(this.publishServerControl(fanFeed, 0));
      this.tempHysteresisFanState.set(
        `${params.deviceId ?? 'global'}:${fanFeed}`,
        false,
      );
    }
    if (ledFeed) {
      stopCommands.push(this.publishServerControl(ledFeed, 0));
    }
    if (stopCommands.length > 0) {
      await Promise.all(stopCommands);
    }

    await this.createPendingAlertIfNeeded(
      params.deviceId,
      'error',
      `${params.deviceName}: Da tu dong dung me say vi vuot nguong he thong (${params.currentTemperature}°C > ${params.maxTempSafe}°C).`,
    );

    this.logger.error(
      `${params.deviceName}: AUTO-STOP batch ${runningBatch.batchesID} do vuot nguong he thong (${params.currentTemperature}°C > ${params.maxTempSafe}°C).`,
    );
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

  private async resolveLegacyLocalProtectionAlerts(
    deviceId: number | null,
  ): Promise<void> {
    const openAlerts = await this.prisma.alert.findMany({
      where: {
        deviceID: deviceId,
        alertStatus: { in: ['pending', 'acknowledged'] },
        alertMessage: {
          contains: 'Bảo vệ cục bộ kích hoạt tại',
          mode: 'insensitive',
        },
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
            resolveNote:
              'Tự động đóng để gộp về cùng condition nhiệt độ vượt ngưỡng an toàn.',
            resolveTime: new Date(),
          },
        }),
      ]),
    );
  }

  private formatSensorFeedLabel(feed: string): string {
    const parsed = this.parseFeedKey(feed) ?? feed;
    return parsed.trim() || feed;
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
    if (!this.parseFeedKey(this.lcdFeedKey)) {
      this.logger.warn(
        'Bo qua auto-update LCD vi ADAFRUIT_IO_LCD_FEED chua duoc cau hinh.',
      );
      return;
    }

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

  private isFeedLimitError(error: unknown): boolean {
    const message =
      error instanceof Error ? error.message : String(error ?? '');
    const normalized = message.toLowerCase();
    return (
      normalized.includes('feed limit reached') ||
      normalized.includes('validation failed')
    );
  }

  private async publishLcdSnapshot(): Promise<void> {
    if (!this.client || !this.isConnected) return;

    const lcdFeed = this.parseFeedKey(this.lcdFeedKey);
    if (!lcdFeed) return;

    const thresholds = await this.getThresholdConfig();
    const operatingMode = await this.modeControl.getCurrentMode();

    const temperature = this.metricState.get('temperature');
    const humidity = this.metricState.get('humidity');
    const light = this.metricState.get('light');

    const lcdSnapshot = buildLcdSnapshot({
      operatingMode,
      nowMs: Date.now(),
      temperature,
      humidity,
      light,
      lightSensorThreshold: thresholds.lightSensorThreshold,
      operatorMessage: this.lastOperatorLcdMessage,
    });

    const line1 = this.toLcdLine(lcdSnapshot.line1);
    const line2 = this.toLcdLine(lcdSnapshot.line2);
    const lcdMessage = `${line1}${line2}`;

    this.publishingAutoLcd = true;
    try {
      await this.publishCommand(lcdFeed, lcdMessage, true);
    } catch (error) {
      if (this.isFeedLimitError(error)) {
        this.stopLcdAutoPushLoop();
        this.logger.error(
          `Dung auto-update LCD do vuot gioi han feed tren Adafruit IO (feed: ${this.lcdFeedKey}).`,
        );
        return;
      }

      throw error;
    } finally {
      this.publishingAutoLcd = false;
    }
  }
}
