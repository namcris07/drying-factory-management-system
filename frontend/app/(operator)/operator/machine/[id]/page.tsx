"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  InputNumber,
  Progress,
  Row,
  Segmented,
  Select,
  Slider,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  BellOutlined,
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOperatorContext } from '@/features/operator/model/operator-context';
import { AIO_THRESHOLDS } from '@/features/operator/adafruit/config/adafruit-config';
import { resolveConfiguredMachineFeeds } from '@/features/operator/adafruit/config/adafruit-config';
import { useAdafruitIO } from '@/features/operator/adafruit/model/use-adafruit-io';
import { OperatingModeToggle } from '@/features/operator/dashboard/ui/OperatingModeToggle';
import { batchesApi, mqttApi, systemConfigApi } from '@/shared/lib/api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const DOOR_OPEN_LUX = AIO_THRESHOLDS.lightDoor;
const HEAT_LOSS_DELAY_MS = 20_000;
const SENSOR_FAULT_TEMP_MIN = 5;
const SENSOR_FAULT_TEMP_MAX = 120;
const NODE_STALE_MS = 2 * 60 * 1000;

type StageSetpoint = {
  stageOrder: number;
  temperatureSetpoint: number;
  humiditySetpoint: number;
};

type CompletionNotice = {
  batchId: number;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
  description: string;
};

type PanelMode = 'overview' | 'sensors' | 'actuators' | 'rules';
type ActuatorFilter = 'all' | 'fan' | 'pump' | 'led' | 'lcd' | 'heater' | 'humidifier' | 'other';

type SensorNode = {
  key: string;
  feed: string;
  sensorName?: string;
  sensorType: string;
  value: number | null;
  unit: string;
  updatedAt: string | null;
};

type ActuatorNode = {
  key: string;
  feed: string;
  actuatorName?: string;
  actuatorType: string;
  /** Giá trị hiện tại (có thể là numeric hoặc string) */
  value: unknown;
  updatedAt: string | null;
};

type ActuatorKind = Exclude<ActuatorFilter, 'all'>;

type DynamicControlComparator = 'gte' | 'lte';
type DynamicFanComparator = DynamicControlComparator;


type DynamicFanRule = {
  id: string;
  enabled: boolean;
  category: 'critical' | 'normal';
  sensorFeed: string;
  comparator: DynamicFanComparator;
  threshold: number;
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
  priority: number;
  cooldownMs: number;
};


type DynamicFanRuleDraft = {
  sensorFeed: string;
  comparator: DynamicFanComparator;
  threshold: number;
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
  priority: number;
  cooldownMs: number;
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


type DynamicFanGroupRule = {
  id: string;
  enabled: boolean;
  operator: DynamicFanGroupOperator;
  conditions: DynamicFanGroupCondition[];
  outputs: DynamicFanGroupOutput[];
  priority: number;
  cooldownMs: number;
};


type DynamicFanGroupDraft = {
  operator: DynamicFanGroupOperator;
  sensorFeed: string;
  comparator: DynamicFanComparator;
  threshold: number;
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
  priority: number;
  cooldownMs: number;
};

type DynamicControlConflictSettings = {
  defaultCooldownMs: number;
  allowEqualPriorityTakeover: boolean;
};

type DynamicFanConflictSettings = DynamicControlConflictSettings;

function inferDeviceId(machineCode: string): number | null {
  const m = machineCode.match(/(\d+)$/);
  if (!m) return null;
  const num = Number(m[1]);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function normalizeFeedName(feed: string): string {
  return feed.toLowerCase().replace(/[^a-z0-9]/g, '');
}

type StatusKey = 'Running' | 'Idle' | 'Error' | 'Maintenance';

const statusCfg: Record<StatusKey, { text: string; tagColor: 'success' | 'default' | 'error' | 'warning' }> = {
  Running: { text: 'Đang chạy', tagColor: 'success' },
  Idle: { text: 'Đang chờ', tagColor: 'default' },
  Error: { text: 'Lỗi', tagColor: 'error' },
  Maintenance: { text: 'Bảo trì', tagColor: 'warning' },
};

function toSensorUnit(sensorType: string) {
  const type = String(sensorType ?? '').toLowerCase();
  if (type.includes('temp')) return '°C';
  if (type.includes('humid')) return '%';
  if (type.includes('light') || type.includes('lux')) return 'lux';
  if (type.includes('fan')) return '%';
  return '';
}

function toSensorLabel(sensorType: string) {
  const type = String(sensorType ?? '').toLowerCase();
  if (type.includes('temp')) return 'Nhiệt độ';
  if (type.includes('humid')) return 'Độ ẩm';
  if (type.includes('light') || type.includes('lux')) return 'Ánh sáng';
  if (type.includes('fan')) return 'Quạt';
  if (type.includes('lcd')) return 'LCD';
  if (type.includes('led')) return 'LED';
  return sensorType || 'Sensor';
}

function getActuatorKind(actuatorType: string): ActuatorKind {
  const type = String(actuatorType ?? '').toLowerCase();
  if (type.includes('fan')) return 'fan';
  if (type.includes('pump')) return 'pump';
  if (type.includes('led')) return 'led';
  if (type.includes('lcd')) return 'lcd';
  if (type.includes('heater')) return 'heater';
  if (type.includes('humidifier')) return 'humidifier';
  return 'other';
}

function coerceNumericValue(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function coerceSwitchValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toUpperCase();
    return normalized === '1' || normalized === 'ON' || normalized === 'TRUE';
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

export default function OperatorMachineDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const machineId = decodeURIComponent(params.id);
  const { message } = App.useApp();
  const [nowSnapshot, setNowSnapshot] = useState<number>(() => Date.now());
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [heatLossDetected, setHeatLossDetected] = useState(false);
  const [operatingMode, setOperatingMode] = useState<'auto' | 'manual'>('auto');
  const [manualTempSetpoint, setManualTempSetpoint] = useState(60);
  const [manualHumiditySetpoint, setManualHumiditySetpoint] = useState(45);
  const [savingSetpoint, setSavingSetpoint] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  const [activeBatchStartedAt, setActiveBatchStartedAt] = useState<string | null>(null);
  const [activeBatchTotalMinutes, setActiveBatchTotalMinutes] = useState<number | null>(null);
  const [currentBatchStage, setCurrentBatchStage] = useState<number | null>(null);
  const [currentStageSetpoint, setCurrentStageSetpoint] = useState<StageSetpoint | null>(null);
  const [pendingManualStageOrder, setPendingManualStageOrder] = useState<number | null>(null);
  const [completionNotice, setCompletionNotice] = useState<CompletionNotice | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('overview');
  const [actuatorFilter, setActuatorFilter] = useState<ActuatorFilter>('all');
  const [actuatorBusyMap, setActuatorBusyMap] = useState<Record<string, boolean>>({});
  const [actuatorLevelDraftMap, setActuatorLevelDraftMap] = useState<Record<string, number>>({});
  const [lcdDraftByFeed, setLcdDraftByFeed] = useState<Record<string, string>>({});
  const [dynamicFanRules, setDynamicFanRules] = useState<DynamicFanRule[]>([]);
  const [ruleDraft, setRuleDraft] = useState<DynamicFanRuleDraft>({
    sensorFeed: '',
    comparator: 'gte',
    threshold: 60,
    fanFeed: '',
    fanLevelOn: 70,
    fanLevelOff: 0,
    priority: 1000,
    cooldownMs: 2000,
  });
  const [dynamicFanGroups, setDynamicFanGroups] = useState<DynamicFanGroupRule[]>([]);
  const [groupDraft, setGroupDraft] = useState<DynamicFanGroupDraft>({
    operator: 'AND',
    sensorFeed: '',
    comparator: 'gte',
    threshold: 60,
    fanFeed: '',
    fanLevelOn: 70,
    fanLevelOff: 0,
    priority: 200,
    cooldownMs: 8000,
  });
  const [conflictSettings, setConflictSettings] =
    useState<DynamicFanConflictSettings>({
      defaultCooldownMs: 5000,
      allowEqualPriorityTakeover: false,
    });
  const [savingRules, setSavingRules] = useState(false);
  const [maxTempSafeThreshold, setMaxTempSafeThreshold] = useState(90);
  const [blinkOn, setBlinkOn] = useState(true);
  const doorOpenSinceRef = useRef<number | null>(null);
  const heatLossNotifiedRef = useRef(false);
  const lastSeenStageRef = useRef<number | null>(null);
  const lastRunningBatchIdRef = useRef<number | null>(null);
  const suppressedCompletionBatchIdsRef = useRef<Set<number>>(new Set());
  const notifiedCompletionBatchIdsRef = useRef<Set<number>>(new Set());

  const { machines, zone, recipes, setMachines } = useOperatorContext();

  const machine = useMemo(
    () => machines.find((item) => item.id === machineId),
    [machines, machineId],
  );

  const feeds = useMemo(
    () =>
      resolveConfiguredMachineFeeds({
        machineId,
        sensorFeeds: machine?.sensorFeeds,
        allowGeneratedFallback: false,
      }),
    [machine?.sensorFeeds, machineId],
  );
  const deviceId = useMemo(
    () => machine?.deviceID ?? inferDeviceId(machineId),
    [machine?.deviceID, machineId],
  );

  const {
    sensor,
    output,
    history,
    loading,
    connected,
    errorMsg,
    lastUpdated,
    setFanLevel,
    refresh,
  } = useAdafruitIO(feeds, {
    averageFeeds: machine?.sensorFeeds ?? [],
    tempFaultRange: {
      min: SENSOR_FAULT_TEMP_MIN,
      max: SENSOR_FAULT_TEMP_MAX,
    },
  });

  const configuredFeedKeys = useMemo(() => {
    return new Set(
      [...(machine?.sensorFeeds ?? [])]
        .map((feed) => normalizeFeedName(String(feed ?? '').trim()))
        .filter(Boolean),
    );
  }, [machine?.sensorFeeds]);

  const criticalRulesConfigKey = useMemo(
    () => `operatorFanRules.${machineId}.criticalAtoms`,
    [machineId],
  );
  const legacyRulesConfigKey = useMemo(
    () => `operatorFanRules.${machineId}`,
    [machineId],
  );
  const groupRulesConfigKey = useMemo(
    () => `operatorFanRuleGroups.${machineId}.normalGroups`,
    [machineId],
  );

  const hasFeed = (tokens: string[]) => {
    for (const feed of configuredFeedKeys) {
      for (const token of tokens) {
        if (feed.includes(token)) return true;
      }
    }
    return false;
  };

  const hasTemperatureFeed = hasFeed(['temp', 'temperature']);
  const hasHumidityFeed = hasFeed(['humid', 'humidity']);
  const hasLightFeed = hasFeed(['light', 'lux']);
  const hasFanFeed = hasFeed(['fan']);

  const sensorNodes = useMemo<SensorNode[]>(() => {
    const rows = machine?.sensorState ?? [];
    const mapped = rows.map((row) => {
      const numeric = Number(row.value);
      const value = Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
      return {
        key: `${row.feed}-${row.sensorType}`,
        feed: row.feed,
        sensorName: row.sensorName,
        sensorType: row.sensorType,
        value,
        unit: toSensorUnit(row.sensorType),
        updatedAt: row.updatedAt,
      };
    });

    if (mapped.length > 0) return mapped;

    return [
      {
        key: 'fallback-temp',
        feed: 'temperature',
        sensorType: 'temperature',
        value: Number.isFinite(Number(sensor.temperature)) ? sensor.temperature : null,
        unit: '°C',
        updatedAt: null,
      },
      {
        key: 'fallback-humidity',
        feed: 'humidity',
        sensorType: 'humidity',
        value: Number.isFinite(Number(sensor.humidity)) ? sensor.humidity : null,
        unit: '%',
        updatedAt: null,
      },
    ];
  }, [machine?.sensorState, sensor.humidity, sensor.temperature]);

  const groupedSensorNodes = useMemo(() => {
    const groups: Record<string, SensorNode[]> = {
      temperature: [],
      humidity: [],
      light: [],
      other: [],
    };

    for (const row of sensorNodes) {
      const type = normalizeFeedName(row.sensorType);
      if (type.includes('temp')) groups.temperature.push(row);
      else if (type.includes('humid')) groups.humidity.push(row);
      else if (type.includes('light') || type.includes('lux')) groups.light.push(row);
      else groups.other.push(row);
    }

    return groups;
  }, [sensorNodes]);

  const fanNodes = useMemo(() => {
    const fromSensors = sensorNodes.filter((row) => normalizeFeedName(row.feed).includes('fan'));
    if (fromSensors.length > 0) {
      return fromSensors.map((row, index) => ({
        key: row.key,
        name: `Quạt ${index + 1}`,
        feed: row.feed,
        level: row.value,
        updatedAt: row.updatedAt,
      }));
    }

    if (hasFanFeed) {
      return [
        {
          key: 'primary-fan',
          name: 'Quạt chính',
          feed: feeds?.fanLevel || 'fan-primary',
          level: Number(output.fanLevel),
          updatedAt: null,
        },
      ];
    }

    return [];
  }, [feeds?.fanLevel, hasFanFeed, output.fanLevel, sensorNodes]);

  const actuatorNodes = useMemo<ActuatorNode[]>(() => {
    // Ưu tiên dùng actuatorState từ context (channel metadata)
    const fromContext = machine?.actuatorState ?? [];
    if (fromContext.length > 0) {
      return fromContext.map((row, index) => ({
        key: `${row.feed}-${row.actuatorType}-${index}`,
        feed: row.feed,
        actuatorName: row.actuatorName || row.actuatorType,
        actuatorType: row.actuatorType,
        value: row.value,
        updatedAt: row.updatedAt,
      }));
    }

    // Fallback: tìm từ sensorState có type là actuator-like
    const ACTUATOR_TYPES = ['fan', 'led', 'lcd', 'pump', 'heater', 'humidifier'];
    const isActuator = (type: string) =>
      ACTUATOR_TYPES.some((t) => String(type).toLowerCase().includes(t));

    const fromSensors = sensorNodes.filter((row) => isActuator(row.sensorType));
    if (fromSensors.length > 0) {
      return fromSensors.map((row) => ({
        key: row.key,
        feed: row.feed,
        actuatorName: row.sensorName || row.sensorType,
        actuatorType: row.sensorType,
        value: row.value,
        updatedAt: row.updatedAt,
      }));
    }

    // Fallback cuối: dùng fanNodes nếu có để backward compat
    return fanNodes.map((fan) => ({
      key: fan.key,
      feed: fan.feed,
      actuatorName: fan.name,
      actuatorType: 'Fan',
      value: fan.level,
      updatedAt: fan.updatedAt,
    }));
  }, [fanNodes, machine?.actuatorState, sensorNodes]);

  /** Options cho rule: chấp hành mục tiêu */
  const actuatorRuleOptions = useMemo(() => {
    const feeds = Array.from(
      new Set(actuatorNodes.map((node) => node.feed).filter(Boolean)),
    );
    return feeds.map((feed) => ({
      value: feed,
      label: `${feed}`,
    }));
  }, [actuatorNodes]);

  const groupedActuatorNodes = useMemo(() => {
    const groups: Record<ActuatorKind, ActuatorNode[]> = {
      fan: [],
      pump: [],
      led: [],
      lcd: [],
      heater: [],
      humidifier: [],
      other: [],
    };

    for (const node of actuatorNodes) {
      groups[getActuatorKind(node.actuatorType)].push(node);
    }

    return groups;
  }, [actuatorNodes]);

  const filteredActuatorNodes = useMemo(() => {
    if (actuatorFilter === 'all') return actuatorNodes;
    return actuatorNodes.filter((node) => getActuatorKind(node.actuatorType) === actuatorFilter);
  }, [actuatorFilter, actuatorNodes]);

  const groupedFilteredActuatorNodes = useMemo(() => {
    const groups: Record<ActuatorKind, ActuatorNode[]> = {
      fan: [],
      pump: [],
      led: [],
      lcd: [],
      heater: [],
      humidifier: [],
      other: [],
    };

    for (const node of filteredActuatorNodes) {
      groups[getActuatorKind(node.actuatorType)].push(node);
    }

    return groups;
  }, [filteredActuatorNodes]);

  const sensorSummary = useMemo(() => {
    const total = sensorNodes.length;
    const hasRecent = sensorNodes.filter((row) => row.updatedAt).length;
    return {
      total,
      online: hasRecent,
      offline: Math.max(0, total - hasRecent),
    };
  }, [sensorNodes]);

  useEffect(() => {
    setActuatorLevelDraftMap((prev) => {
      const next = { ...prev };
      for (const node of actuatorNodes) {
        const kind = getActuatorKind(node.actuatorType);
        if (kind !== 'fan') continue;
        if (next[node.feed] !== undefined) continue;
        const numeric = coerceNumericValue(node.value);
        next[node.feed] = Math.max(0, Math.min(100, Math.round(numeric ?? 0)));
      }
      return next;
    });

    setLcdDraftByFeed((prev) => {
      const next = { ...prev };
      for (const node of actuatorNodes) {
        const kind = getActuatorKind(node.actuatorType);
        if (kind !== 'lcd') continue;
        if (next[node.feed] !== undefined) continue;
        next[node.feed] = typeof node.value === 'string' ? node.value : '';
      }
      return next;
    });
  }, [actuatorNodes]);

  const healthyTemperatureValues = useMemo(() => {
    return sensorNodes
      .filter((row) => normalizeFeedName(row.sensorType).includes('temp'))
      .filter(
        (row) =>
          Number.isFinite(row.value) &&
          (row.value as number) >= SENSOR_FAULT_TEMP_MIN &&
          (row.value as number) <= SENSOR_FAULT_TEMP_MAX,
      )
      .map((row) => row.value)
      .filter((value): value is number => Number.isFinite(value));
  }, [sensorNodes]);

  const healthyTemperatureCount = healthyTemperatureValues.length;

  const averageTemperature = useMemo(() => {
    if (healthyTemperatureValues.length === 0) return null;
    return Math.round(
      (healthyTemperatureValues.reduce((sum, current) => sum + current, 0) /
        healthyTemperatureValues.length) *
        10,
    ) / 10;
  }, [healthyTemperatureValues]);

  const faultyTemperatureCount = useMemo(() => {
    return sensorNodes.filter((row) => {
      if (!normalizeFeedName(row.sensorType).includes('temp')) return false;
      if (!Number.isFinite(row.value)) return false;
      return (
        (row.value as number) < SENSOR_FAULT_TEMP_MIN ||
        (row.value as number) > SENSOR_FAULT_TEMP_MAX
      );
    }).length;
  }, [sensorNodes]);

  const criticalTemperatureCount = useMemo(() => {
    return sensorNodes.filter((row) => {
      if (!normalizeFeedName(row.sensorType).includes('temp')) return false;
      if (!Number.isFinite(row.value)) return false;
      const value = row.value as number;
      if (value < SENSOR_FAULT_TEMP_MIN || value > SENSOR_FAULT_TEMP_MAX) return false;
      return value > maxTempSafeThreshold;
    }).length;
  }, [maxTempSafeThreshold, sensorNodes]);

  const humidityValues = useMemo(() => {
    return sensorNodes
      .filter((row) => normalizeFeedName(row.sensorType).includes('humid'))
      .map((row) => row.value)
      .filter((value): value is number => Number.isFinite(value));
  }, [sensorNodes]);

  const humiditySensorCount = humidityValues.length;

  const averageHumidity = useMemo(() => {
    if (humidityValues.length === 0) return null;
    return Math.round((humidityValues.reduce((sum, current) => sum + current, 0) / humidityValues.length) * 10) / 10;
  }, [humidityValues]);

  const sensorRuleOptions = useMemo(
    () =>
      sensorNodes
        .filter((row) => {
          const normalized = normalizeFeedName(row.feed);
          return !normalized.includes('fan') && row.value !== null;
        })
        .map((row) => ({
          value: row.feed,
          label: `${toSensorLabel(row.sensorType)} · ${row.feed}`,
        })),
    [sensorNodes],
  );

  const fanRuleOptions = useMemo(() => {
    const feeds = Array.from(new Set(fanNodes.map((node) => node.feed).filter(Boolean)));
    return feeds.map((feed, index) => ({
      value: feed,
      label: `Quạt ${index + 1} · ${feed}`,
    }));
  }, [fanNodes]);

  const parseDynamicRules = (raw: string | undefined): DynamicFanRule[] => {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row, index) => {
          if (!row || typeof row !== 'object') return null;
          const rule = row as Partial<DynamicFanRule>;
          const comparator: DynamicFanComparator = rule.comparator === 'lte' ? 'lte' : 'gte';
          const threshold = Number(rule.threshold);
          const fanLevelOn = Number(rule.fanLevelOn);
          const fanLevelOff = Number(rule.fanLevelOff);
          const priority = Number(rule.priority);
          const cooldownMs = Number(rule.cooldownMs);
          const categoryRaw = String(rule.category ?? 'critical').toLowerCase();
          const sensorFeed = String(rule.sensorFeed ?? '').trim();
          const fanFeed = String(rule.fanFeed ?? '').trim();
          if (!sensorFeed || !fanFeed) return null;

          return {
            id: String(rule.id ?? `rule-${index + 1}`),
            enabled: Boolean(rule.enabled),
            category: categoryRaw === 'critical' ? 'critical' : 'normal',
            sensorFeed,
            comparator,
            threshold: Number.isFinite(threshold) ? threshold : 0,
            fanFeed,
            fanLevelOn: Number.isFinite(fanLevelOn) ? Math.max(0, Math.min(100, fanLevelOn)) : 70,
            fanLevelOff: Number.isFinite(fanLevelOff) ? Math.max(0, Math.min(100, fanLevelOff)) : 0,
            priority: Number.isFinite(priority) ? Math.max(0, Math.round(priority)) : 1000,
            cooldownMs: Number.isFinite(cooldownMs) ? Math.max(0, Math.round(cooldownMs)) : 2000,
          } as DynamicFanRule;
        })
        .filter((rule): rule is DynamicFanRule => Boolean(rule));
    } catch {
      return [];
    }
  };

  const parseDynamicGroups = (raw: string | undefined): DynamicFanGroupRule[] => {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row, index) => {
          if (!row || typeof row !== 'object') return null;
          const group = row as Partial<DynamicFanGroupRule>;
          const conditions = Array.isArray(group.conditions)
            ? group.conditions
                .map((condition) => {
                  if (!condition || typeof condition !== 'object') return null;
                  const c = condition as Partial<DynamicFanGroupCondition>;
                  const sensorFeed = String(c.sensorFeed ?? '').trim();
                  if (!sensorFeed) return null;
                  const threshold = Number(c.threshold);
                  return {
                    sensorFeed,
                    comparator: c.comparator === 'lte' ? 'lte' : 'gte',
                    threshold: Number.isFinite(threshold) ? threshold : 0,
                  } as DynamicFanGroupCondition;
                })
                .filter((condition): condition is DynamicFanGroupCondition => Boolean(condition))
            : [];

          const outputs = Array.isArray(group.outputs)
            ? group.outputs
                .map((output) => {
                  if (!output || typeof output !== 'object') return null;
                  const o = output as Partial<DynamicFanGroupOutput>;
                  const fanFeed = String(o.fanFeed ?? '').trim();
                  if (!fanFeed) return null;
                  const on = Number(o.fanLevelOn);
                  const off = Number(o.fanLevelOff);
                  return {
                    fanFeed,
                    fanLevelOn: Number.isFinite(on) ? Math.max(0, Math.min(100, on)) : 70,
                    fanLevelOff: Number.isFinite(off) ? Math.max(0, Math.min(100, off)) : 0,
                  } as DynamicFanGroupOutput;
                })
                .filter((output): output is DynamicFanGroupOutput => Boolean(output))
            : [];

          if (conditions.length === 0 || outputs.length === 0) return null;

          const priority = Number(group.priority);
          const cooldownMs = Number(group.cooldownMs);

          return {
            id: String(group.id ?? `group-${index + 1}`),
            enabled: Boolean(group.enabled),
            operator: group.operator === 'AND' ? 'AND' : 'OR',
            conditions,
            outputs,
            priority: Number.isFinite(priority) ? Math.max(0, Math.round(priority)) : 200,
            cooldownMs: Number.isFinite(cooldownMs) ? Math.max(0, Math.round(cooldownMs)) : 8000,
          } as DynamicFanGroupRule;
        })
        .filter((group): group is DynamicFanGroupRule => Boolean(group));
    } catch {
      return [];
    }
  };

  const valueFromSensorState = (tokens: string[]): number | null => {
    const row = (machine?.sensorState ?? []).find((item) => {
      const normalized = normalizeFeedName(item.feed);
      return tokens.some((token) => normalized.includes(token));
    });
    if (!row) return null;
    const num = Number(row.value);
    return Number.isFinite(num) ? num : null;
  };

  const effectiveTemperature = hasTemperatureFeed
    ? (valueFromSensorState(['temp', 'temperature']) ?? sensor.temperature)
    : null;
  const effectiveHumidity = hasHumidityFeed
    ? (valueFromSensorState(['humid', 'humidity']) ?? sensor.humidity)
    : null;
  const effectiveLight = hasLightFeed
    ? (valueFromSensorState(['light', 'lux']) ?? sensor.light)
    : null;

  const elapsedMsSnapshot = (() => {
    if (activeBatchStartedAt) {
      const startedAt = new Date(activeBatchStartedAt);
      if (!Number.isNaN(startedAt.getTime())) {
        return Math.max(0, nowSnapshot - startedAt.getTime());
      }
    }

    if (!machine?.startTime) return 0;
    const [h, m] = machine.startTime.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;

    const startedAt = new Date();
    startedAt.setHours(h, m, 0, 0);

    let diffMs = nowSnapshot - startedAt.getTime();
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    return Math.max(0, diffMs);
  })();

  const elapsed = (() => {
    if (elapsedMsSnapshot <= 0) return '--';
    const dh = Math.floor(elapsedMsSnapshot / 3600000);
    const dm = Math.floor((elapsedMsSnapshot % 3600000) / 60000);
    return `${dh}h ${dm}m`;
  })();

  const effectiveSelectedRecipeId = selectedRecipeId ?? machine?.recipeId ?? null;

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === effectiveSelectedRecipeId),
    [effectiveSelectedRecipeId, recipes],
  );

  const activeRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === machine?.recipeId),
    [recipes, machine?.recipeId],
  );

  const calculatedProgress = useMemo(() => {
    const totalMinutes =
      activeBatchTotalMinutes && activeBatchTotalMinutes > 0
        ? activeBatchTotalMinutes
        : activeRecipe?.duration;

    if (!totalMinutes) {
      return typeof machine?.progress === 'number' ? machine.progress : undefined;
    }

    const elapsedMs = elapsedMsSnapshot;
    if (elapsedMs <= 0) return 0;

    const durationMs = totalMinutes * 60 * 1000;
    if (durationMs <= 0) return typeof machine?.progress === 'number' ? machine.progress : undefined;

    return Math.max(0, Math.min(100, Math.round((elapsedMs / durationMs) * 100)));
  }, [activeBatchTotalMinutes, activeRecipe?.duration, elapsedMsSnapshot, machine?.progress]);

  const doorOpenByLux =
    hasLightFeed && effectiveLight !== null && effectiveLight > DOOR_OPEN_LUX;
  const isManualMode = operatingMode === 'manual';

  const recipeTempSetpoint = selectedRecipe?.temp ?? activeRecipe?.temp ?? null;
  const recipeHumiditySetpoint =
    selectedRecipe?.humidity ?? activeRecipe?.humidity ?? null;

  const autoTempSetpoint =
    currentStageSetpoint?.temperatureSetpoint ?? recipeTempSetpoint;
  const autoHumiditySetpoint =
    currentStageSetpoint?.humiditySetpoint ?? recipeHumiditySetpoint;

  const formulaTempExceeded =
    !isManualMode &&
    autoTempSetpoint !== null &&
    effectiveTemperature !== null &&
    Number.isFinite(effectiveTemperature) &&
    effectiveTemperature > autoTempSetpoint;

  const manualTempExceedDelta =
    isManualMode &&
    autoTempSetpoint !== null &&
    effectiveTemperature !== null &&
    Number.isFinite(effectiveTemperature)
      ? Math.max(0, effectiveTemperature - autoTempSetpoint)
      : 0;
  const manualHumidityExceedDelta =
    isManualMode &&
    autoHumiditySetpoint !== null &&
    effectiveHumidity !== null &&
    Number.isFinite(effectiveHumidity)
      ? Math.max(0, effectiveHumidity - autoHumiditySetpoint)
      : 0;
  const manualFormulaExceeded =
    machine?.status === 'Running' &&
    (manualTempExceedDelta > 0 || manualHumidityExceedDelta > 0);

  const manualRecommendedFanLevel = Math.max(
    20,
    Math.min(
      100,
      Math.round(
        25 + manualTempExceedDelta * 8 + manualHumidityExceedDelta * 3,
      ),
    ),
  );

  const visibleTempSetpoint = isManualMode
    ? manualTempSetpoint
    : (autoTempSetpoint ?? manualTempSetpoint);
  const visibleHumiditySetpoint = isManualMode
    ? manualHumiditySetpoint
    : (autoHumiditySetpoint ?? manualHumiditySetpoint);

  useEffect(() => {
    const id = setInterval(() => {
      setNowSnapshot(Date.now());
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setBlinkOn((prev) => !prev);
    }, 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    let mounted = true;
    const runningStatuses = new Set(['Running', 'InProgress', 'Active', 'Processing']);

    const syncBatchStage = async () => {
      try {
        const batchList = await batchesApi.getAll({
          status: 'running',
          page: 1,
          pageSize: 100,
        });
        if (!mounted) return;

        const activeBatch = batchList.items.find(
          (batch) =>
            batch.deviceID === deviceId &&
            runningStatuses.has(batch.batchStatus ?? ''),
        );

        if (!activeBatch) {
          const previousBatchId = lastRunningBatchIdRef.current;

          if (
            previousBatchId !== null &&
            !suppressedCompletionBatchIdsRef.current.has(previousBatchId) &&
            !notifiedCompletionBatchIdsRef.current.has(previousBatchId)
          ) {
            try {
              const completedBatch = await batchesApi.getOne(previousBatchId);
              if (!mounted) return;

              const status = String(completedBatch.batchStatus ?? '').toLowerCase();
              const result = String(completedBatch.batchResult ?? '').toLowerCase();
              const mode = String(completedBatch.operationMode ?? '').toLowerCase();
              const isStoppedByOperator =
                status === 'stopped' || result.includes('stoppedbyoperator');

              if (!isStoppedByOperator) {
                const isManualCompletion = mode === 'manual';
                const isFailed = status === 'fail' || result.includes('fail') || result.includes('error');

                let nextNotice: CompletionNotice;
                if (isFailed) {
                  nextNotice = {
                    batchId: previousBatchId,
                    type: 'error',
                    message: `Mẻ #${previousBatchId} kết thúc với trạng thái lỗi`,
                    description:
                      'Hệ thống ghi nhận mẻ chưa hoàn tất bình thường. Vui lòng kiểm tra cảnh báo, nhật ký và xác nhận điều kiện an toàn trước khi chạy mẻ mới.',
                  };
                } else if (isManualCompletion) {
                  nextNotice = {
                    batchId: previousBatchId,
                    type: 'warning',
                    message: `Mẻ #${previousBatchId} đã hoàn thành ở chế độ Manual`,
                    description:
                      'Vui lòng thực hiện hậu kiểm, xác nhận chất lượng và chốt mẻ trước khi chuyển sang lô tiếp theo.',
                  };
                } else {
                  nextNotice = {
                    batchId: previousBatchId,
                    type: 'success',
                    message: `Mẻ #${previousBatchId} đã hoàn thành tự động`,
                    description:
                      'Có thể bắt đầu bước lấy sản phẩm, làm nguội và chuẩn bị máy cho mẻ kế tiếp.',
                  };
                }

                setCompletionNotice(nextNotice);
                if (nextNotice.type === 'warning') {
                  message.warning(nextNotice.message);
                } else if (nextNotice.type === 'error') {
                  message.error(nextNotice.message);
                } else {
                  message.success(nextNotice.message);
                }
                notifiedCompletionBatchIdsRef.current.add(previousBatchId);
              }
            } catch {
              // Ignore transient completion lookup failures; next sync will retry.
            }
          }

          lastRunningBatchIdRef.current = null;
          lastSeenStageRef.current = null;
          setActiveBatchId(null);
          setActiveBatchStartedAt(null);
          setActiveBatchTotalMinutes(null);
          setCurrentBatchStage(null);
          setCurrentStageSetpoint(null);
          setPendingManualStageOrder(null);
          return;
        }

        setActiveBatchId(activeBatch.batchesID);
  lastRunningBatchIdRef.current = activeBatch.batchesID;
        const stageOrder = activeBatch.currentStage ?? null;
        setCurrentBatchStage(stageOrder);

        const detail = await batchesApi.getOne(activeBatch.batchesID);
        if (!mounted) return;

        setActiveBatchStartedAt(detail.startedAt ?? activeBatch.startedAt ?? null);

        const stages = detail.recipe?.stages ?? [];
        const stageDurationMinutes = stages.reduce((sum, stage) => {
          const minutes = Number(stage.durationMinutes ?? 0);
          return Number.isFinite(minutes) ? sum + minutes : sum;
        }, 0);
        const fallbackDurationMinutes = Number(detail.recipe?.timeDurationEst ?? 0);
        const resolvedDurationMinutes =
          stageDurationMinutes > 0 ? stageDurationMinutes : fallbackDurationMinutes;
        setActiveBatchTotalMinutes(
          Number.isFinite(resolvedDurationMinutes) && resolvedDurationMinutes > 0
            ? resolvedDurationMinutes
            : null,
        );

        const stageFromRecipe =
          stages.find((stage) => stage.stageOrder === (stageOrder ?? -1)) ??
          null;

        if (stageFromRecipe) {
          setCurrentStageSetpoint({
            stageOrder: stageFromRecipe.stageOrder,
            temperatureSetpoint: Number(stageFromRecipe.temperatureSetpoint),
            humiditySetpoint: Number(stageFromRecipe.humiditySetpoint),
          });
        } else {
          setCurrentStageSetpoint(null);
        }

        if (
          isManualMode &&
          stageOrder !== null &&
          lastSeenStageRef.current !== null &&
          lastSeenStageRef.current !== stageOrder
        ) {
          setPendingManualStageOrder(stageOrder);
          message.warning(
            `Đã chuyển sang giai đoạn ${stageOrder}. Chế độ Manual cần Operator xác nhận setpoint.`,
          );
        }

        if (stageOrder !== null) {
          lastSeenStageRef.current = stageOrder;
        }
      } catch {
        // Keep last known stage if API is temporarily unavailable.
      }
    };

    void syncBatchStage();
    const interval = setInterval(() => {
      void syncBatchStage();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [deviceId, isManualMode, message]);

  useEffect(() => {
    let mounted = true;

    const loadModeAndSetpoints = async () => {
      try {
        const cfg = await systemConfigApi.getAll();
        if (!mounted) return;

        const mode = (cfg.operatingMode ?? 'auto') as 'auto' | 'manual';
        setOperatingMode(mode);

        const temp = Number(cfg.manualTargetTemp);
        const humidity = Number(cfg.manualTargetHumidity);
        const loadedRules = parseDynamicRules(
          cfg[criticalRulesConfigKey] ?? cfg[legacyRulesConfigKey],
        );
        const loadedGroups = parseDynamicGroups(cfg[groupRulesConfigKey]);

        if (Number.isFinite(temp)) {
          setManualTempSetpoint(Math.max(30, Math.min(95, temp)));
        }
        if (Number.isFinite(humidity)) {
          setManualHumiditySetpoint(Math.max(5, Math.min(90, humidity)));
        }
        const maxTempSafe = Number(cfg.maxTempSafe);
        if (Number.isFinite(maxTempSafe)) {
          setMaxTempSafeThreshold(maxTempSafe);
        }
        setDynamicFanRules(loadedRules);
        setDynamicFanGroups(loadedGroups);
        setConflictSettings({
          defaultCooldownMs: Number.isFinite(
            Number(cfg['operatorFanRuleConflict.defaultCooldownMs']),
          )
            ? Math.max(0, Math.round(Number(cfg['operatorFanRuleConflict.defaultCooldownMs'])))
            : 5000,
          allowEqualPriorityTakeover:
            String(cfg['operatorFanRuleConflict.allowEqualPriorityTakeover'] ?? 'false') ===
            'true',
        });
      } catch {
        // Keep local defaults if config endpoint is temporarily unavailable.
      }
    };

    void loadModeAndSetpoints();

    return () => {
      mounted = false;
    };
  }, [criticalRulesConfigKey, groupRulesConfigKey, legacyRulesConfigKey]);

  useEffect(() => {
    if (ruleDraft.sensorFeed) return;
    const nextSensorFeed = sensorRuleOptions[0]?.value ?? '';
    const nextFanFeed = fanRuleOptions[0]?.value ?? '';
    if (!nextSensorFeed && !nextFanFeed) return;

    setRuleDraft((prev) => ({
      ...prev,
      sensorFeed: prev.sensorFeed || nextSensorFeed,
      fanFeed: prev.fanFeed || nextFanFeed,
    }));
  }, [fanRuleOptions, ruleDraft.sensorFeed, sensorRuleOptions]);

  useEffect(() => {
    if (groupDraft.sensorFeed) return;
    const nextSensorFeed = sensorRuleOptions[0]?.value ?? '';
    const nextFanFeed = fanRuleOptions[0]?.value ?? '';
    if (!nextSensorFeed && !nextFanFeed) return;

    setGroupDraft((prev) => ({
      ...prev,
      sensorFeed: prev.sensorFeed || nextSensorFeed,
      fanFeed: prev.fanFeed || nextFanFeed,
    }));
  }, [fanRuleOptions, groupDraft.sensorFeed, sensorRuleOptions]);

  const persistHybridRules = async (
    nextRules: DynamicFanRule[],
    nextGroups: DynamicFanGroupRule[],
    nextConflict: DynamicFanConflictSettings,
    options?: { silent?: boolean },
  ) => {
    setSavingRules(true);
    try {
      await systemConfigApi.saveAll({
        [criticalRulesConfigKey]: JSON.stringify(nextRules),
        [groupRulesConfigKey]: JSON.stringify(nextGroups),
        'operatorFanRuleConflict.defaultCooldownMs': String(
          Math.max(0, Math.round(nextConflict.defaultCooldownMs)),
        ),
        'operatorFanRuleConflict.allowEqualPriorityTakeover': String(
          nextConflict.allowEqualPriorityTakeover,
        ),
      });
      if (!options?.silent) {
        message.success('Đã lưu cấu hình hybrid rule cho operator.');
      }
    } catch {
      message.error('Không thể lưu cấu hình hybrid rule.');
    } finally {
      setSavingRules(false);
    }
  };

  const persistManualSetpoint = async (next: {
    manualTargetTemp: number;
    manualTargetHumidity: number;
  }) => {
    if (!isManualMode) return;

    setSavingSetpoint(true);
    try {
      await systemConfigApi.saveAll({
        manualTargetTemp: String(next.manualTargetTemp),
        manualTargetHumidity: String(next.manualTargetHumidity),
      });
      message.success('Da luu setpoint thu cong.');
    } catch {
      message.warning('Khong luu duoc setpoint thu cong len he thong.');
    } finally {
      setSavingSetpoint(false);
    }
  };

  const applyCurrentStageToManual = async () => {
    if (!currentStageSetpoint) {
      message.warning('Chưa đồng bộ được setpoint của giai đoạn hiện tại.');
      return;
    }

    const nextTemp = Math.max(
      30,
      Math.min(95, Math.round(currentStageSetpoint.temperatureSetpoint)),
    );
    const nextHumidity = Math.max(
      5,
      Math.min(90, Math.round(currentStageSetpoint.humiditySetpoint)),
    );

    setManualTempSetpoint(nextTemp);
    setManualHumiditySetpoint(nextHumidity);
    await persistManualSetpoint({
      manualTargetTemp: nextTemp,
      manualTargetHumidity: nextHumidity,
    });
    setPendingManualStageOrder(null);
    message.success(
      `Đã áp dụng setpoint giai đoạn ${currentStageSetpoint.stageOrder} cho Manual.`,
    );
  };

  const applyManualRecommendedFan = async () => {
    if (!hasFanFeed) {
      message.warning('Thiết bị chưa cấu hình feed quạt.');
      return;
    }
    if (!isManualMode) {
      message.warning('Chỉ dùng khuyến nghị quạt trong chế độ Manual.');
      return;
    }

    const ok = await setFanLevel(manualRecommendedFanLevel);

    if (ok) {
      message.success(
        `Đã áp dụng quạt khuyến nghị ${manualRecommendedFanLevel}% cho Manual.`,
      );
      return;
    }

    message.error('Không đồng bộ được quạt khuyến nghị lên Adafruit IO.');
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (!machine || machine.status !== 'Running') {
        doorOpenSinceRef.current = null;
        heatLossNotifiedRef.current = false;
        setHeatLossDetected((prev) => (prev ? false : prev));
        return;
      }

      if (!doorOpenByLux) {
        doorOpenSinceRef.current = null;
        heatLossNotifiedRef.current = false;
        setHeatLossDetected((prev) => (prev ? false : prev));
        return;
      }

      if (!doorOpenSinceRef.current) {
        doorOpenSinceRef.current = Date.now();
        return;
      }

      if (!heatLossNotifiedRef.current && Date.now() - doorOpenSinceRef.current >= HEAT_LOSS_DELAY_MS) {
        heatLossNotifiedRef.current = true;
        setHeatLossDetected(true);
        message.warning(`Phat hien that thoat nhiet: lux > ${DOOR_OPEN_LUX} trong hon ${HEAT_LOSS_DELAY_MS / 1000}s.`);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [doorOpenByLux, machine, message]);

  if (!machine) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Text type="secondary" style={{ fontSize: 16 }}>
          Khong tim thay thiet bi.
        </Text>
        <br />
        <Button
          type="link"
          icon={<ReloadOutlined />}
          onClick={() => router.push('/operator')}
          style={{ marginTop: 8 }}
        >
          Quay lai danh sach
        </Button>
      </div>
    );
  }

  const cfg = statusCfg[machine.status];
  const isRunning = machine.status === 'Running';
  const isIdle = machine.status === 'Idle';
  const isError = machine.status === 'Error';
  const isMaintenance = machine.status === 'Maintenance';
  const doorOpen = doorOpenByLux;

  const handleQuickStartBatch = async () => {
    if (!selectedRecipe) {
      message.warning('Vui lòng chon công thức say trước khi khởi động.');
      return;
    }
    if (isMaintenance) {
      message.warning('Thiết bị đang bảo trì, không thể khởi động máy sấy.');
      return;
    }

    if (!machine.deviceID) {
      message.warning('Không xác định được buồng sấy để khởi động mẻ sấy.');
      return;
    }

    try {
      const createdBatch = await batchesApi.create({
        recipeID: selectedRecipe.id,
        chamberID: machine.deviceID,
        operationMode: operatingMode,
        startTime: new Date().toISOString(),
      });
      setActiveBatchId(createdBatch.batchesID);
      setCompletionNotice(null);

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      setMachines((prev) =>
        prev.map((item) =>
          item.id === machineId
            ? {
              ...item,
              status: 'Running',
              recipe: selectedRecipe.name,
              recipeId: selectedRecipe.id,
              progress: 0,
              startTime: timeStr,
            }
            : item,
        ),
      );

      message.success(`Đã khởi động nhanh mẻ sấy: ${selectedRecipe.name}.`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Khởi động mẻ sấy thất bại.');
    }
  };

  const handleStopBatch = async () => {
    try {
      if (activeBatchId) {
        suppressedCompletionBatchIdsRef.current.add(activeBatchId);
        notifiedCompletionBatchIdsRef.current.add(activeBatchId);
        setCompletionNotice(null);
        await batchesApi.update(activeBatchId, {
          batchStatus: 'Stopped',
          batchResult: 'StoppedByOperator',
        });
        setActiveBatchId(null);
        lastRunningBatchIdRef.current = null;
        setCurrentBatchStage(null);
      }

      setMachines((prev) =>
        prev.map((item) =>
          item.id === machineId
            ? {
              ...item,
              status: 'Idle',
              progress: undefined,
              startTime: undefined,
              recipe: undefined,
              recipeId: undefined,
            }
            : item,
        ),
      );
      message.info('Đã dừng mẻ sấy hiện tại.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Đã xảy ra lỗi khi dừng mẻ sấy.');
    }
  };
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}p`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h${m}p`;
  };

  const updateActuatorValueLocally = (feed: string, value: unknown) => {
    const nowIso = new Date().toISOString();
    setMachines((prev) =>
      prev.map((item) => {
        if (item.id !== machineId) return item;

        const actuatorState = item.actuatorState ?? [];
        const hasActuatorState = actuatorState.some((node) => node.feed === feed);

        return {
          ...item,
          actuatorState: hasActuatorState
            ? actuatorState.map((node) =>
                node.feed === feed ? { ...node, value, updatedAt: nowIso } : node,
              )
            : actuatorState,
          sensorState: (item.sensorState ?? []).map((node) =>
            node.feed === feed ? { ...node, value, updatedAt: nowIso } : node,
          ),
        };
      }),
    );
  };

  const sendActuatorCommand = async (
    feed: string,
    value: unknown,
    successMessage: string,
  ) => {
    if (!feed) {
      message.warning('Thiết bị chưa cấu hình feed điều khiển.');
      return false;
    }
    if (!isManualMode) {
      message.warning('Chỉ điều khiển chấp hành thủ công trong chế độ Manual.');
      return false;
    }

    setActuatorBusyMap((prev) => ({ ...prev, [feed]: true }));
    try {
      const result = await mqttApi.publishCommand(feed, value, true);
      if (!result.ok) {
        message.error(result.note ?? `Không gửi được lệnh tới feed ${feed}.`);
        return false;
      }

      updateActuatorValueLocally(feed, value);
      message.success(successMessage);
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : `Không gửi được lệnh tới feed ${feed}.`);
      return false;
    } finally {
      setActuatorBusyMap((prev) => ({ ...prev, [feed]: false }));
    }
  };

  const handleActuatorSwitch = async (
    node: ActuatorNode,
    nextOn: boolean,
  ) => {
    const label = node.actuatorName || toSensorLabel(node.actuatorType);
    await sendActuatorCommand(node.feed, nextOn ? 1 : 0, `${label} -> ${nextOn ? 'BẬT' : 'TẮT'}`);
  };

  const handleActuatorFanCommit = async (node: ActuatorNode, rawLevel: number) => {
    const nextLevel = Math.max(0, Math.min(100, Math.round(rawLevel)));
    const label = node.actuatorName || 'Quạt';
    await sendActuatorCommand(node.feed, nextLevel, `${label} -> ${nextLevel}%`);
  };

  const handleActuatorLcdSend = async (node: ActuatorNode) => {
    const draft = (lcdDraftByFeed[node.feed] ?? '').trim().slice(0, 32);
    if (!draft) {
      message.warning('Vui lòng nhập nội dung LCD.');
      return;
    }
    const label = node.actuatorName || 'LCD';
    const ok = await sendActuatorCommand(node.feed, draft, `${label} -> Đã gửi nội dung`);
    if (!ok) return;
    setLcdDraftByFeed((prev) => ({ ...prev, [node.feed]: '' }));
  };

  const handleAddDynamicRule = async () => {
    const sensorFeed = ruleDraft.sensorFeed.trim();
    const fanFeed = ruleDraft.fanFeed.trim();
    if (!sensorFeed) {
      message.warning('Vui lòng chọn cảm biến nguồn cho rule.');
      return;
    }
    if (!fanFeed) {
      message.warning('Vui lòng chọn quạt đích cho rule.');
      return;
    }

    const nextRule: DynamicFanRule = {
      id: `R${Date.now().toString(36).toUpperCase()}`,
      enabled: true,
      category: 'critical',
      sensorFeed,
      comparator: ruleDraft.comparator,
      threshold: Number(ruleDraft.threshold),
      fanFeed,
      fanLevelOn: Math.max(0, Math.min(100, Number(ruleDraft.fanLevelOn))),
      fanLevelOff: Math.max(0, Math.min(100, Number(ruleDraft.fanLevelOff))),
      priority: Math.max(0, Math.round(Number(ruleDraft.priority))),
      cooldownMs: Math.max(0, Math.round(Number(ruleDraft.cooldownMs))),
    };

    const nextRules = [...dynamicFanRules, nextRule];
    setDynamicFanRules(nextRules);
    await persistHybridRules(nextRules, dynamicFanGroups, conflictSettings);
  };

  const handleToggleDynamicRule = async (id: string, enabled: boolean) => {
    const nextRules = dynamicFanRules.map((rule) =>
      rule.id === id ? { ...rule, enabled } : rule,
    );
    setDynamicFanRules(nextRules);
    await persistHybridRules(nextRules, dynamicFanGroups, conflictSettings, {
      silent: true,
    });
  };

  const handleDeleteDynamicRule = async (id: string) => {
    const nextRules = dynamicFanRules.filter((rule) => rule.id !== id);
    setDynamicFanRules(nextRules);
    await persistHybridRules(nextRules, dynamicFanGroups, conflictSettings);
  };

  const handleAddGroupRule = async () => {
    const sensorFeed = groupDraft.sensorFeed.trim();
    const fanFeed = groupDraft.fanFeed.trim();
    if (!sensorFeed) {
      message.warning('Vui lòng chọn cảm biến điều kiện cho rule group.');
      return;
    }
    if (!fanFeed) {
      message.warning('Vui lòng chọn quạt đầu ra cho rule group.');
      return;
    }

    const nextGroup: DynamicFanGroupRule = {
      id: `G${Date.now().toString(36).toUpperCase()}`,
      enabled: true,
      operator: groupDraft.operator,
      conditions: [
        {
          sensorFeed,
          comparator: groupDraft.comparator,
          threshold: Number(groupDraft.threshold),
        },
      ],
      outputs: [
        {
          fanFeed,
          fanLevelOn: Math.max(0, Math.min(100, Number(groupDraft.fanLevelOn))),
          fanLevelOff: Math.max(0, Math.min(100, Number(groupDraft.fanLevelOff))),
        },
      ],
      priority: Math.max(0, Math.round(Number(groupDraft.priority))),
      cooldownMs: Math.max(0, Math.round(Number(groupDraft.cooldownMs))),
    };

    const nextGroups = [...dynamicFanGroups, nextGroup];
    setDynamicFanGroups(nextGroups);
    await persistHybridRules(dynamicFanRules, nextGroups, conflictSettings);
  };

  const handleToggleGroupRule = async (id: string, enabled: boolean) => {
    const nextGroups = dynamicFanGroups.map((group) =>
      group.id === id ? { ...group, enabled } : group,
    );
    setDynamicFanGroups(nextGroups);
    await persistHybridRules(dynamicFanRules, nextGroups, conflictSettings, {
      silent: true,
    });
  };

  const handleDeleteGroupRule = async (id: string) => {
    const nextGroups = dynamicFanGroups.filter((group) => group.id !== id);
    setDynamicFanGroups(nextGroups);
    await persistHybridRules(dynamicFanRules, nextGroups, conflictSettings);
  };

  const handleSaveConflictSettings = async () => {
    await persistHybridRules(dynamicFanRules, dynamicFanGroups, conflictSettings);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <Space style={{ marginBottom: 10 }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/operator')}>
                Về dashboard
              </Button>
              <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
                Làm mới
              </Button>
            </Space>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Title level={2} style={{ margin: 0 }}>
                <CloudServerOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                {machine.id} · {machine.name}
              </Title>
              <Tag
                color={cfg.tagColor}
                style={{ borderRadius: 20, fontSize: 14, padding: '4px 14px', border: 'none' }}
                icon={
                  isRunning ? <ThunderboltOutlined />
                    : isIdle ? <PauseCircleOutlined />
                      : isError ? <WarningOutlined /> : <ToolOutlined />
                }
              >
                {cfg.text}
              </Tag>
              <Tag color={connected ? 'success' : 'error'}>
                {connected ? 'MQTT Connected' : 'MQTT Disconnected'}
              </Tag>
            </div>
            <Space style={{ marginTop: 6 }} size={12}>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Zone: <Text strong>{zone}</Text>
              </Text>
              {machine.startTime && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  Bắt đầu {machine.startTime} · Đã chạy {elapsed}
                </Text>
              )}
              {activeRecipe && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <BookOutlined style={{ marginRight: 4, color: '#1677ff' }} />
                  Mẻ sấy: <Text strong style={{ color: '#1677ff' }}>{activeRecipe.name}</Text>
                </Text>
              )}
              {isRunning && (
                <Tag color={currentBatchStage ? 'processing' : 'default'}>
                  {currentBatchStage ? `Giai đoạn ${currentBatchStage}` : 'Đang đồng bộ giai đoạn...'}
                </Tag>
              )}
              {lastUpdated && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cập nhật: {lastUpdated.toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </Text>
              )}
            </Space>
          </div>
          <div style={{ marginBottom: 16, maxWidth: 520 }}>
        <OperatingModeToggle onModeChange={setOperatingMode} />
      </div>
        </div>
      </div>

      

      {errorMsg && (
        <Alert
          style={{ marginBottom: 16, borderRadius: 12 }}
          type="warning"
          showIcon
          message="Cảnh báo kết nối"
          description={errorMsg}
        />
      )}

      {completionNotice && (
        <Alert
          style={{ marginBottom: 16, borderRadius: 12 }}
          type={completionNotice.type}
          showIcon
          closable
          onClose={() => {
            notifiedCompletionBatchIdsRef.current.add(completionNotice.batchId);
            setCompletionNotice(null);
          }}
          message={completionNotice.message}
          description={completionNotice.description}
        />
      )}

      {formulaTempExceeded && (
        <Alert
          style={{ marginBottom: 16, borderRadius: 12 }}
          type="warning"
          showIcon
          message="Nhiệt độ đang vượt ngưỡng công thức"
          description={`Hiện tại ${(effectiveTemperature ?? 0).toFixed(1)}°C > setpoint công thức ${Math.round(autoTempSetpoint as number)}°C. Hệ thống sẽ cảnh báo, quạt chỉ bật theo logic auto hysteresis.`}
        />
      )}

      {isRunning && isManualMode && pendingManualStageOrder !== null && (
        <Alert
          style={{ marginBottom: 16, borderRadius: 12 }}
          type="warning"
          showIcon
          icon={<BellOutlined />}
          message={`Manual mode: cần xác nhận setpoint cho giai đoạn ${pendingManualStageOrder}`}
          description={
            currentStageSetpoint
              ? `Gợi ý từ công thức: ${Math.round(currentStageSetpoint.temperatureSetpoint)}°C / ${Math.round(currentStageSetpoint.humiditySetpoint)}%. Hệ thống không tự ép setpoint trong Manual.`
              : 'Đang chờ đồng bộ setpoint từ recipe stage. Vui lòng theo dõi trước khi vận hành tiếp.'
          }
          action={
            <Space>
              <Button size="small" onClick={() => setPendingManualStageOrder(null)}>
                Tôi sẽ tự chỉnh
              </Button>
              <Button
                size="small"
                type="primary"
                onClick={() => void applyCurrentStageToManual()}
                disabled={!currentStageSetpoint}
              >
                Áp dụng setpoint stage
              </Button>
            </Space>
          }
        />
      )}

      {manualFormulaExceeded && (
        <Alert
          style={{ marginBottom: 16, borderRadius: 12 }}
          type="warning"
          showIcon
          icon={<BellOutlined />}
          message="Manual mode: thông số đang vượt ngưỡng công thức"
          description={
            <>
              <div>
                Nhiệt độ hiện tại {effectiveTemperature?.toFixed(1) ?? '--'}°C,
                mục tiêu {autoTempSetpoint !== null ? Math.round(autoTempSetpoint) : '--'}°C
                {manualTempExceedDelta > 0
                  ? ` (vượt ${manualTempExceedDelta.toFixed(1)}°C).`
                  : '.'}
              </div>
              <div>
                Độ ẩm hiện tại {effectiveHumidity?.toFixed(1) ?? '--'}%, mục tiêu{' '}
                {autoHumiditySetpoint !== null
                  ? Math.round(autoHumiditySetpoint)
                  : '--'}%
                {manualHumidityExceedDelta > 0
                  ? ` (vượt ${manualHumidityExceedDelta.toFixed(1)}%).`
                  : '.'}
              </div>
              <div>
                Khuyến nghị: tăng quạt lên khoảng {manualRecommendedFanLevel}%
                để kéo thông số về vùng an toàn.
              </div>
            </>
          }
          action={
            <Button
              size="small"
              type="primary"
              disabled={!hasFanFeed}
              onClick={() => void applyManualRecommendedFan()}
            >
              Bật quạt theo khuyến nghị
            </Button>
          }
        />
      )}

      {isError && (machine.errorCode || machine.errorMsg) && (
        <Alert
          style={{ marginBottom: 20, borderRadius: 12 }}
          type="error"
          showIcon
          message={
            <div>
              <Text strong style={{ color: '#ff4d4f', marginRight: 8 }}>
                {machine.errorCode || 'ERROR'}
              </Text>
              <Text>{machine.errorMsg || 'Thiet bi gap su co can kiem tra.'}</Text>
            </div>
          }
        />
      )}

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={15} xl={16}>
          <Card
            style={{ borderRadius: 14, marginBottom: 18 }}
            title='Bản đồ node buồng sấy'
            extra={
              <Space size={8}>
                <Tag color='blue'>Tổng node: {sensorSummary.total}</Tag>
                <Tag color='green'>Online: {sensorSummary.online}</Tag>
                {sensorSummary.offline > 0 ? <Tag color='default'>Offline: {sensorSummary.offline}</Tag> : null}
              </Space>
            }
          >
            <Space direction='vertical' size={12} style={{ width: '100%' }}>
              <Segmented<PanelMode>
                block
                value={panelMode}
                onChange={(value) => setPanelMode(value as PanelMode)}
                options={[
                  { label: 'Tổng quan', value: 'overview' },
                  { label: 'Cảm biến', value: 'sensors' },
                  { label: 'Chấp hành', value: 'actuators' },
                  { label: 'Quy tắc', value: 'rules' },
                ]}
              />

              {panelMode === 'overview' ? (
                <>
                  <Row gutter={[12, 12]}>
                    <Col xs={12} md={8}>
                      <Card size='small'>
                        <Statistic
                          title='Nhiệt độ trung bình'
                          value={averageTemperature ?? 0}
                          precision={1}
                          suffix='°C'
                        />
                        <Text type='secondary' style={{ fontSize: 12 }}>
                          Nguồn hợp lệ: {healthyTemperatureCount} cảm biến
                        </Text>
                      </Card>
                    </Col>
                    <Col xs={12} md={8}>
                      <Card size='small'>
                        <Statistic
                          title='Độ ẩm trung bình'
                          value={averageHumidity ?? 0}
                          precision={1}
                          suffix='%'
                        />
                        <Text type='secondary' style={{ fontSize: 12 }}>
                          Nguồn có dữ liệu: {humiditySensorCount} cảm biến
                        </Text>
                      </Card>
                    </Col>
                    <Col xs={12} md={8}>
                      <Card size='small'>
                        <Statistic title='Mức quạt chính' value={Math.round(output.fanLevel)} suffix='%' />
                      </Card>
                    </Col>
                  </Row>
                  <Text type='secondary'>
                    {loading
                      ? 'Đang tải dữ liệu Adafruit IO...'
                      : `Lần cập nhật gần nhất: ${
                          lastUpdated
                            ? lastUpdated.toLocaleTimeString('vi', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : 'chưa có dữ liệu'
                        }`}
                  </Text>
                  <Space wrap>
                    <Tag color={faultyTemperatureCount > 0 ? 'warning' : 'default'}>
                      Sensor lỗi ảo: {faultyTemperatureCount}
                    </Tag>
                    <Tag color={criticalTemperatureCount > 0 ? 'error' : 'default'}>
                      Sensor vượt ngưỡng {maxTempSafeThreshold}°C: {criticalTemperatureCount}
                    </Tag>
                  </Space>
                </>
              ) : null}

              {panelMode === 'sensors' ? (
                <Space direction='vertical' size={12} style={{ width: '100%' }}>
                  {[
                    { key: 'temperature', title: 'Nhóm nhiệt độ' },
                    { key: 'humidity', title: 'Nhóm độ ẩm' },
                    { key: 'light', title: 'Nhóm ánh sáng' },
                    { key: 'other', title: 'Nhóm khác' },
                  ].map((group) => {
                    const rows = groupedSensorNodes[group.key] ?? [];
                    if (rows.length === 0) return null;

                    return (
                      <Card key={group.key} size='small' title={`${group.title} (${rows.length})`}>
                        <Row gutter={[12, 12]}>
                          {rows.map((row) => {
                            const isTempSensor = normalizeFeedName(row.sensorType).includes('temp');
                            const hasNumericValue = Number.isFinite(row.value);
                            const tempValue = hasNumericValue ? (row.value as number) : null;
                            const updatedAtMs = row.updatedAt ? new Date(row.updatedAt).getTime() : null;
                            const isMissing =
                              !hasNumericValue ||
                              updatedAtMs === null ||
                              nowSnapshot - updatedAtMs > NODE_STALE_MS;
                            const isFaulty =
                              isTempSensor &&
                              tempValue !== null &&
                              (tempValue < SENSOR_FAULT_TEMP_MIN || tempValue > SENSOR_FAULT_TEMP_MAX);
                            const isCritical =
                              isTempSensor &&
                              tempValue !== null &&
                              !isFaulty &&
                              tempValue > maxTempSafeThreshold;
                            const pulseDanger = isCritical && blinkOn;

                            const cardTone = isFaulty || isCritical
                              ? {
                                  borderColor: '#ff4d4f',
                                  background: '#fff1f0',
                                  boxShadow: pulseDanger
                                    ? '0 0 0 2px rgba(255,77,79,0.18), 0 0 18px rgba(255,77,79,0.28)'
                                    : '0 0 0 1px rgba(255,77,79,0.16)',
                                }
                              : isMissing
                                ? {
                                    borderColor: '#faad14',
                                    background: '#fffbe6',
                                    boxShadow: '0 0 0 1px rgba(250,173,20,0.15)',
                                  }
                                : {
                                    borderColor: '#91caff',
                                    background: '#e6f4ff',
                                    boxShadow: '0 0 0 1px rgba(22,119,255,0.16)',
                                  };

                            return (
                            <Col xs={24} md={12} xl={8} key={row.key}>
                              <Card
                                size='small'
                                style={cardTone}
                              >
                                <Space direction='vertical' size={2} style={{ width: '100%' }}>
                                  <Text strong>{row.sensorName || toSensorLabel(row.sensorType)}</Text>
                                  <Text type='secondary'>
                                    {toSensorLabel(row.sensorType)} · {row.feed}
                                  </Text>
                                  <Text>
                                    {row.value ?? '--'} {row.unit}
                                  </Text>
                                  {isMissing ? (
                                    <Tag color='warning'>Thiếu dữ liệu hoặc node quá hạn cập nhật</Tag>
                                  ) : null}
                                  {isFaulty ? (
                                    <Tag color='warning'>Sensor lỗi dải: loại khỏi trung bình</Tag>
                                  ) : null}
                                  {isCritical ? (
                                    <Tag color={pulseDanger ? 'error' : 'volcano'}>
                                      Cảnh báo cục bộ: vượt {maxTempSafeThreshold}°C
                                    </Tag>
                                  ) : null}
                                  <Text type='secondary' style={{ fontSize: 12 }}>
                                    {row.updatedAt
                                      ? dayjs(row.updatedAt).format('HH:mm:ss DD/MM')
                                      : 'Chưa có timestamp'}
                                  </Text>
                                </Space>
                              </Card>
                            </Col>
                          )})}
                        </Row>
                      </Card>
                    );
                  })}
                </Space>
              ) : null}

              {panelMode === 'actuators' ? (
                <Space direction='vertical' size={12} style={{ width: '100%' }}>
                  <Alert
                    type={isManualMode ? 'success' : 'warning'}
                    showIcon
                    message={isManualMode
                      ? 'Chế độ Manual: cho phép điều khiển từng chấp hành theo feed.'
                      : 'Chế độ Auto: chỉ giám sát trạng thái chấp hành, không cho phép điều khiển thủ công.'}
                  />

                  <Segmented<ActuatorFilter>
                    block
                    value={actuatorFilter}
                    onChange={(value) => setActuatorFilter(value as ActuatorFilter)}
                    options={[
                      { label: `Tất cả (${actuatorNodes.length})`, value: 'all' },
                      { label: `Quạt (${groupedActuatorNodes.fan.length})`, value: 'fan' },
                      { label: `Bơm (${groupedActuatorNodes.pump.length})`, value: 'pump' },
                      { label: `LED (${groupedActuatorNodes.led.length})`, value: 'led' },
                      { label: `LCD (${groupedActuatorNodes.lcd.length})`, value: 'lcd' },
                      { label: `Khác (${groupedActuatorNodes.other.length})`, value: 'other' },
                    ]}
                  />

                  {actuatorNodes.length === 0 ? (
                    <Empty
                      description='Chưa phát hiện thiết bị chấp hành nào. Vui lòng cấu hình actuator channel cho thiết bị này.'
                    />
                  ) : (
                    <>
                      <Text type='secondary' style={{ fontSize: 13 }}>
                        Hiển thị {filteredActuatorNodes.length}/{actuatorNodes.length} chấp hành theo bộ lọc.
                      </Text>
                      {([
                        'fan',
                        'pump',
                        'led',
                        'lcd',
                        'heater',
                        'humidifier',
                        'other',
                      ] as ActuatorKind[]).map((kind) => {
                        const nodes = groupedFilteredActuatorNodes[kind];
                        if (nodes.length === 0) return null;

                        const titleMap: Record<ActuatorKind, string> = {
                          fan: 'Nhóm quạt',
                          pump: 'Nhóm bơm',
                          led: 'Nhóm LED',
                          lcd: 'Nhóm LCD',
                          heater: 'Nhóm gia nhiệt',
                          humidifier: 'Nhóm tạo ẩm',
                          other: 'Nhóm khác',
                        };
                        const colorMap: Record<ActuatorKind, string> = {
                          fan: 'blue',
                          pump: 'geekblue',
                          led: 'gold',
                          lcd: 'cyan',
                          heater: 'volcano',
                          humidifier: 'green',
                          other: 'purple',
                        };

                        return (
                          <Card key={kind} size='small' title={`${titleMap[kind]} (${nodes.length})`}>
                            <Row gutter={[12, 12]}>
                              {nodes.map((node, index) => {
                                const numericVal = coerceNumericValue(node.value);
                                const isOn = coerceSwitchValue(node.value);
                                const isBusy = Boolean(actuatorBusyMap[node.feed]);
                                const fanDraft = actuatorLevelDraftMap[node.feed] ?? Math.max(0, Math.min(100, Math.round(numericVal ?? 0)));
                                const lcdDraft = lcdDraftByFeed[node.feed] ?? '';

                                return (
                                  <Col xs={24} md={12} xl={8} key={node.key}>
                                    <Card size='small'>
                                      <Space direction='vertical' size={8} style={{ width: '100%' }}>
                                        <Space size={6} wrap>
                                          <Text strong>{node.actuatorName || titleMap[kind]} {index + 1}</Text>
                                          <Tag color={colorMap[kind]}>{titleMap[kind]}</Tag>
                                        </Space>
                                        <Text type='secondary'>{node.feed}</Text>
                                        <Text>
                                          {numericVal !== null ? numericVal.toFixed(1) : String(node.value ?? '--')}
                                          {kind === 'fan' && numericVal !== null ? '%' : ''}
                                        </Text>

                                        {kind === 'fan' ? (
                                          <>
                                            <Slider
                                              min={0}
                                              max={100}
                                              step={1}
                                              value={fanDraft}
                                              disabled={!isManualMode || isBusy}
                                              onChange={(value) => {
                                                if (typeof value !== 'number') return;
                                                setActuatorLevelDraftMap((prev) => ({
                                                  ...prev,
                                                  [node.feed]: value,
                                                }));
                                              }}
                                              onChangeComplete={(value) => {
                                                if (typeof value !== 'number') return;
                                                void handleActuatorFanCommit(node, value);
                                              }}
                                            />
                                            <Space wrap>
                                              <Button
                                                size='small'
                                                disabled={!isManualMode || isBusy}
                                                onClick={() => {
                                                  setActuatorLevelDraftMap((prev) => ({ ...prev, [node.feed]: 0 }));
                                                  void handleActuatorFanCommit(node, 0);
                                                }}
                                              >
                                                0%
                                              </Button>
                                              <Button
                                                size='small'
                                                disabled={!isManualMode || isBusy}
                                                onClick={() => {
                                                  setActuatorLevelDraftMap((prev) => ({ ...prev, [node.feed]: 50 }));
                                                  void handleActuatorFanCommit(node, 50);
                                                }}
                                              >
                                                50%
                                              </Button>
                                              <Button
                                                size='small'
                                                disabled={!isManualMode || isBusy}
                                                onClick={() => {
                                                  setActuatorLevelDraftMap((prev) => ({ ...prev, [node.feed]: 100 }));
                                                  void handleActuatorFanCommit(node, 100);
                                                }}
                                              >
                                                100%
                                              </Button>
                                            </Space>
                                          </>
                                        ) : null}

                                        {kind === 'lcd' ? (
                                          <>
                                            <TextArea
                                              rows={2}
                                              maxLength={64}
                                              value={lcdDraft}
                                              onChange={(e) =>
                                                setLcdDraftByFeed((prev) => ({
                                                  ...prev,
                                                  [node.feed]: e.target.value,
                                                }))
                                              }
                                              disabled={!isManualMode || isBusy}
                                              placeholder='Nhập tối đa 32 ký tự...'
                                            />
                                            <Button
                                              type='primary'
                                              size='small'
                                              loading={isBusy}
                                              disabled={!isManualMode || !lcdDraft.trim()}
                                              onClick={() => void handleActuatorLcdSend(node)}
                                            >
                                              Gửi LCD
                                            </Button>
                                          </>
                                        ) : null}

                                        {kind !== 'fan' && kind !== 'lcd' ? (
                                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                            <Tag color={isOn ? 'success' : 'default'}>
                                              {isOn ? 'Đang bật' : 'Đang tắt'}
                                            </Tag>
                                            <Switch
                                              checked={isOn}
                                              loading={isBusy}
                                              disabled={!isManualMode || isBusy}
                                              onChange={(checked) => {
                                                void handleActuatorSwitch(node, checked);
                                              }}
                                            />
                                          </Space>
                                        ) : null}

                                        <Text type='secondary' style={{ fontSize: 12 }}>
                                          {node.updatedAt
                                            ? dayjs(node.updatedAt).format('HH:mm:ss DD/MM')
                                            : 'Chưa có dữ liệu'}
                                        </Text>
                                      </Space>
                                    </Card>
                                  </Col>
                                );
                              })}
                            </Row>
                          </Card>
                        );
                      })}
                    </>
                  )}
                </Space>
              ) : null}

              {panelMode === 'rules' ? (
                <Space direction='vertical' size={12} style={{ width: '100%' }}>
                  <Card size='small' title='Rule động cảm biến → chấp hành'>
                    <Space direction='vertical' size={10} style={{ width: '100%' }}>
                      <Text strong>1) Quy tắc hoạt động</Text>
                      <Row gutter={[8, 8]}>
                        <Col xs={24} md={10}>
                          <Select
                            style={{ width: '100%' }}
                            placeholder='Chọn cảm biến nguồn'
                            value={ruleDraft.sensorFeed || undefined}
                            options={sensorRuleOptions}
                            onChange={(value) =>
                              setRuleDraft((prev) => ({ ...prev, sensorFeed: value }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <Select
                            style={{ width: '100%' }}
                            value={ruleDraft.comparator}
                            options={[
                              { value: 'gte', label: '>=' },
                              { value: 'lte', label: '<=' },
                            ]}
                            onChange={(value) =>
                              setRuleDraft((prev) => ({
                                ...prev,
                                comparator: value as DynamicFanComparator,
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <InputNumber
                            style={{ width: '100%' }}
                            value={ruleDraft.threshold}
                            onChange={(value) =>
                              setRuleDraft((prev) => ({
                                ...prev,
                                threshold: Number(value ?? 0),
                              }))
                            }
                            placeholder='Ngưỡng'
                          />
                        </Col>
                        <Col xs={24} md={6}>
                          <Select
                            style={{ width: '100%' }}
                            placeholder='Chọn chấp hành đích'
                            value={ruleDraft.fanFeed || undefined}
                            options={actuatorRuleOptions.length > 0 ? actuatorRuleOptions : fanRuleOptions}
                            onChange={(value) =>
                              setRuleDraft((prev) => ({ ...prev, fanFeed: value }))
                            }
                          />
                        </Col>
                      </Row>

                      <Row gutter={[8, 8]}>
                        <Col xs={24} md={8}>
                          <InputNumber
                            min={0}
                            max={100}
                            style={{ width: '100%' }}
                            value={ruleDraft.fanLevelOn}
                            addonBefore='Quạt bật %'
                            onChange={(value) =>
                              setRuleDraft((prev) => ({
                                ...prev,
                                fanLevelOn: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={8}>
                          <InputNumber
                            min={0}
                            max={100}
                            style={{ width: '100%' }}
                            value={ruleDraft.fanLevelOff}
                            addonBefore='Quạt tắt %'
                            onChange={(value) =>
                              setRuleDraft((prev) => ({
                                ...prev,
                                fanLevelOff: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            value={ruleDraft.priority}
                            addonBefore='Ưu tiên'
                            onChange={(value) =>
                              setRuleDraft((prev) => ({
                                ...prev,
                                priority: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            value={ruleDraft.cooldownMs}
                            addonBefore='Cooldown'
                            onChange={(value) =>
                              setRuleDraft((prev) => ({
                                ...prev,
                                cooldownMs: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={8}>
                          <Button
                            type='primary'
                            block
                            loading={savingRules}
                            onClick={() => void handleAddDynamicRule()}
                          >
                            Thêm quy tắc
                          </Button>
                        </Col>
                      </Row>

                      {dynamicFanRules.length === 0 ? (
                        <Empty description='Chưa có quy tắc cho quạt' image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ) : (
                        <Space direction='vertical' size={8} style={{ width: '100%' }}>
                          {dynamicFanRules.map((rule) => (
                            <Card size='small' key={rule.id}>
                              <Row gutter={[8, 8]} align='middle'>
                                <Col xs={24} md={16}>
                                  <Space size={8} wrap>
                                    <Tag color={rule.enabled ? 'green' : 'default'}>{rule.id}</Tag>
                                    <Tag color='red'>critical</Tag>
                                    <Text>{rule.sensorFeed}</Text>
                                    <Tag>{rule.comparator}</Tag>
                                    <Tag color='orange'>{rule.threshold}</Tag>
                                    <Text>{'->'}</Text>
                                    <Text>{rule.fanFeed}</Text>
                                    <Tag color='blue'>ON {rule.fanLevelOn}%</Tag>
                                    <Tag>OFF {rule.fanLevelOff}%</Tag>
                                    <Tag color='purple'>P{rule.priority}</Tag>
                                    <Tag>CD {rule.cooldownMs}ms</Tag>
                                  </Space>
                                </Col>
                                <Col xs={24} md={8}>
                                  <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                                    <Switch
                                      checked={rule.enabled}
                                      onChange={(checked) => void handleToggleDynamicRule(rule.id, checked)}
                                    />
                                    <Button danger size='small' onClick={() => void handleDeleteDynamicRule(rule.id)}>
                                      Xóa
                                    </Button>
                                  </Space>
                                </Col>
                              </Row>
                            </Card>
                          ))}
                        </Space>
                      )}

                      <Divider style={{ margin: '8px 0' }} />
                      <Text strong>2) Nhóm quy tắc thông thường (AND/OR)</Text>
                      <Row gutter={[8, 8]}>
                        <Col xs={24} md={5}>
                          <Select
                            style={{ width: '100%' }}
                            value={groupDraft.operator}
                            options={[
                              { value: 'AND', label: 'AND' },
                              { value: 'OR', label: 'OR' },
                            ]}
                            onChange={(value) =>
                              setGroupDraft((prev) => ({
                                ...prev,
                                operator: value as DynamicFanGroupOperator,
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={9}>
                          <Select
                            style={{ width: '100%' }}
                            placeholder='Cảm biến điều kiện'
                            value={groupDraft.sensorFeed || undefined}
                            options={sensorRuleOptions}
                            onChange={(value) =>
                              setGroupDraft((prev) => ({ ...prev, sensorFeed: value }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <Select
                            style={{ width: '100%' }}
                            value={groupDraft.comparator}
                            options={[
                              { value: 'gte', label: '>=' },
                              { value: 'lte', label: '<=' },
                            ]}
                            onChange={(value) =>
                              setGroupDraft((prev) => ({
                                ...prev,
                                comparator: value as DynamicFanComparator,
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={6}>
                          <InputNumber
                            style={{ width: '100%' }}
                            value={groupDraft.threshold}
                            onChange={(value) =>
                              setGroupDraft((prev) => ({
                                ...prev,
                                threshold: Number(value ?? 0),
                              }))
                            }
                            placeholder='Ngưỡng'
                          />
                        </Col>
                      </Row>
                      <Row gutter={[8, 8]}>
                        <Col xs={24} md={8}>
                          <Select
                            style={{ width: '100%' }}
                            placeholder='Chấp hành đầu ra'
                            value={groupDraft.fanFeed || undefined}
                            options={actuatorRuleOptions.length > 0 ? actuatorRuleOptions : fanRuleOptions}
                            onChange={(value) =>
                              setGroupDraft((prev) => ({ ...prev, fanFeed: value }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <InputNumber
                            min={0}
                            max={100}
                            style={{ width: '100%' }}
                            value={groupDraft.fanLevelOn}
                            addonBefore='ON %'
                            onChange={(value) =>
                              setGroupDraft((prev) => ({
                                ...prev,
                                fanLevelOn: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <InputNumber
                            min={0}
                            max={100}
                            style={{ width: '100%' }}
                            value={groupDraft.fanLevelOff}
                            addonBefore='OFF %'
                            onChange={(value) =>
                              setGroupDraft((prev) => ({
                                ...prev,
                                fanLevelOff: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            value={groupDraft.priority}
                            addonBefore='Prio'
                            onChange={(value) =>
                              setGroupDraft((prev) => ({
                                ...prev,
                                priority: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={4}>
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            value={groupDraft.cooldownMs}
                            addonBefore='Thời gian chờ (ms)'
                            onChange={(value) =>
                              setGroupDraft((prev) => ({
                                ...prev,
                                cooldownMs: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                      </Row>
                      <Button
                        type='dashed'
                        loading={savingRules}
                        onClick={() => void handleAddGroupRule()}
                      >
                        Thêm quy tắc nhóm
                      </Button>

                      {dynamicFanGroups.length === 0 ? (
                        <Empty description='Chưa có rule group cho vận hành thường' image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ) : (
                        <Space direction='vertical' size={8} style={{ width: '100%' }}>
                          {dynamicFanGroups.map((group) => {
                            const firstCondition = group.conditions[0];
                            const firstOutput = group.outputs[0];
                            return (
                              <Card size='small' key={group.id}>
                                <Row gutter={[8, 8]} align='middle'>
                                  <Col xs={24} md={16}>
                                    <Space size={8} wrap>
                                      <Tag color={group.enabled ? 'green' : 'default'}>{group.id}</Tag>
                                      <Tag color='blue'>{group.operator}</Tag>
                                      <Tag color='gold'>normal</Tag>
                                      {firstCondition ? (
                                        <>
                                          <Text>{firstCondition.sensorFeed}</Text>
                                          <Tag>{firstCondition.comparator}</Tag>
                                          <Tag color='orange'>{firstCondition.threshold}</Tag>
                                        </>
                                      ) : null}
                                      <Text>{'->'}</Text>
                                      {firstOutput ? (
                                        <>
                                          <Text>{firstOutput.fanFeed}</Text>
                                          <Tag color='blue'>ON {firstOutput.fanLevelOn}%</Tag>
                                          <Tag>OFF {firstOutput.fanLevelOff}%</Tag>
                                        </>
                                      ) : null}
                                      <Tag color='purple'>P{group.priority}</Tag>
                                      <Tag>CD {group.cooldownMs}ms</Tag>
                                    </Space>
                                  </Col>
                                  <Col xs={24} md={8}>
                                    <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                                      <Switch
                                        checked={group.enabled}
                                        onChange={(checked) => void handleToggleGroupRule(group.id, checked)}
                                      />
                                      <Button danger size='small' onClick={() => void handleDeleteGroupRule(group.id)}>
                                        Xóa
                                      </Button>
                                    </Space>
                                  </Col>
                                </Row>
                              </Card>
                            );
                          })}
                        </Space>
                      )}

                      <Divider style={{ margin: '8px 0' }} />
                      <Text strong>3) Conflict Resolution</Text>
                      <Row gutter={[8, 8]} align='middle'>
                        <Col xs={24} md={8}>
                          <InputNumber
                            min={0}
                            style={{ width: '100%' }}
                            value={conflictSettings.defaultCooldownMs}
                            addonBefore='Thời gian mặc định'
                            onChange={(value) =>
                              setConflictSettings((prev) => ({
                                ...prev,
                                defaultCooldownMs: Number(value ?? 0),
                              }))
                            }
                          />
                        </Col>
                        <Col xs={24} md={8}>
                          <Space>
                            <Switch
                              checked={conflictSettings.allowEqualPriorityTakeover}
                              onChange={(checked) =>
                                setConflictSettings((prev) => ({
                                  ...prev,
                                  allowEqualPriorityTakeover: checked,
                                }))
                              }
                            />
                            <Text>Cho phép chuyển quyền điều khiển giữa các quy tắc cùng mức độ ưu tiên</Text>
                          </Space>
                        </Col>
                        <Col xs={24} md={8}>
                          <Button
                            block
                            loading={savingRules}
                            onClick={() => void handleSaveConflictSettings()}
                          >
                            Lưu cài đặt điều phối xung đột
                          </Button>
                        </Col>
                      </Row>
                    </Space>
                  </Card>

                </Space>
              ) : null}
            </Space>
          </Card>

          <Card
            style={{ borderRadius: 14, marginBottom: 18 }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Diễn biến nhiệt độ & độ ẩm (trung bình)</span>
                {isRunning && (
                  <Badge status="processing" text={<Text style={{ fontSize: 12 }}>Đang cập nhật</Text>} />
                )}
              </div>
            }
          >
            {isRunning && (hasTemperatureFeed || hasHumidityFeed) ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={history} margin={{ top: 5, right: 24, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis
                    yAxisId="temp"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}°`}
                    width={38}
                  />
                  <YAxis
                    yAxisId="hum"
                    orientation="right"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    width={38}
                  />
                  <ReTooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #f0f0f0', fontSize: 13 }}
                    formatter={(val: number, name: string) => [
                      name === 'temperature' ? `${val}°C` : `${val}%`,
                      name === 'temperature' ? 'Nhiệt độ' : 'Độ ẩm',
                    ]}
                  />
                  <Legend
                    formatter={(n) => n === 'temperature' ? 'Nhiệt độ (°C)' : 'Độ ẩm (%)'}
                    iconType="circle"
                    iconSize={9}
                  />
                  {hasTemperatureFeed && (
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="temperature"
                      name="temperature"
                      stroke="#ff7a00"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: '#ff7a00' }}
                    />
                  )}
                  {hasHumidityFeed && (
                    <Line
                      yAxisId="hum"
                      type="monotone"
                      dataKey="humidity"
                      name="humidity"
                      stroke="#1677ff"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: '#1677ff' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: 260,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#bfbfbf',
                  background: '#fafafa',
                  borderRadius: 10,
                }}
              >
                <PauseCircleOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                <Text type="secondary">
                  {isRunning
                    ? 'Thiết bị chưa cấu hình feed nhiệt độ/độ ẩm để hiển thị biểu đồ'
                    : 'Biểu đồ sẽ hiển thị khi máy đang chạy'}
                </Text>
              </div>
            )}
          </Card>

          <Row gutter={[14, 14]}>
            {typeof calculatedProgress === 'number' && (
              <Col span={24}>
                <Card style={{ borderRadius: 12 }} styles={{ body: { padding: '16px 20px' } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                    <Text strong>Tiến độ máy sấy</Text>
                    <Text strong style={{ fontSize: 18, color: '#1677ff' }}>
                      {Math.round(calculatedProgress)}%
                    </Text>
                  </div>
                  <Progress
                    percent={Math.round(calculatedProgress)}
                    strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
                    size={['100%', 14]}
                    status={calculatedProgress === 100 ? 'success' : 'active'}
                  />
                </Card>
              </Col>
            )}

            <Col xs={12}>
              <Card
                style={{
                  borderRadius: 12,
                  textAlign: 'center',
                  border: doorOpen ? '2px solid #ffccc7' : '1px solid #f0f0f0',
                  background: doorOpen ? '#fff2f0' : '#fff',
                }}
                styles={{ body: { padding: '20px 16px' } }}
              >
                <div style={{ fontSize: 42, marginBottom: 8, lineHeight: 1 }}>
                  {doorOpen ? '🚪' : '🔒'}
                </div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Cửa buồng sấy</Text>
                <Tag
                  color={doorOpen ? 'error' : 'success'}
                  style={{ borderRadius: 20, padding: '3px 12px' }}
                >
                  {doorOpen ? 'Đang mở' : 'Đã đóng'}
                </Tag>
                {doorOpen && (
                  <div style={{ marginTop: 6 }}>
                    <Text type="danger" style={{ fontSize: 11 }}>Cảnh báo: Cửa đang mở</Text>
                  </div>
                )}
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Ngưỡng mở cửa: lux {'>'} {DOOR_OPEN_LUX}
                  </Text>
                </div>
              </Card>
            </Col>

            <Col xs={12}>
              <Card
                style={{ borderRadius: 12, textAlign: 'center' }}
                styles={{ body: { padding: '20px 16px' } }}
              >
                <div style={{ fontSize: 42, marginBottom: 8, lineHeight: 1 }}>⏱</div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>Thời gian chạy</Text>
                <Text style={{ fontSize: 20, fontWeight: 700, color: isRunning ? '#1677ff' : '#8c8c8c' }}>
                  {isRunning ? elapsed : '--'}
                </Text>
              </Card>
            </Col>
          </Row>
        </Col>

        <Col xs={24} lg={9} xl={8}>
          <Card
            style={{ borderRadius: 14, position: 'sticky', top: 80 }}
            title={<span style={{ fontWeight: 600 }}>Bảng điều khiển</span>}
          >
            {(isIdle || isError) && (
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                  <BookOutlined style={{ color: '#1677ff', marginRight: 6 }} />
                  Chọn công thức sấy để khởi động nhanh
                </Text>
                <Select
                  placeholder="Chọn công thức sấy..."
                  value={selectedRecipeId ?? undefined}
                  onChange={(value) => setSelectedRecipeId(value)}
                  style={{ width: '100%' }}
                  size="large"
                  options={recipes.map((recipe) => ({
                    value: recipe.id,
                    label: `${recipe.name} - ${recipe.temp}°C · ${formatDuration(recipe.duration)}`,                  }))}
                />
                {selectedRecipe && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: '10px 14px',
                      background: '#f6ffed',
                      borderRadius: 10,
                      border: '1px solid #b7eb8f',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: '#389e0d' }}>
                      <CheckCircleOutlined style={{ marginRight: 6 }} />
                      {selectedRecipe.name}
                    </Text>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>Nhiệt độ: {selectedRecipe.temp}°C</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>Độ ẩm: {selectedRecipe.humidity}%</Text>
<Text type="secondary" style={{ fontSize: 12 }}>
  Thời lượng: {formatDuration(selectedRecipe.duration)}
</Text>                    </div>
                  </div>
                )}
              </div>
            )}

            {isIdle && (
              <Button
                type="primary"
                block
                size="large"
                icon={<PlayCircleOutlined />}
                disabled={!selectedRecipeId}
                onClick={() => void handleQuickStartBatch()}
                style={{
                  height: 54,
                  borderRadius: 14,
                  fontSize: 17,
                  fontWeight: 800,
                  background: selectedRecipeId ? '#52c41a' : undefined,
                  borderColor: selectedRecipeId ? '#52c41a' : undefined,
                  marginBottom: 14,
                }}
              >
                Khởi động nhanh
              </Button>
            )}

            {isRunning && (
              <Button
                danger
                block
                size="large"
                onClick={() => void handleStopBatch()}
                style={{
                  height: 54,
                  borderRadius: 14,
                  fontSize: 17,
                  fontWeight: 800,
                  marginBottom: 14,
                }}
              >
                DỪNG MÁY SẤY
              </Button>
            )}

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                Setpoint nhiệt độ & độ ẩm
              </Text>
              <Card size="small" style={{ borderRadius: 10, marginBottom: 10 }} styles={{ body: { padding: 12 } }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <div>
                    <Text type="secondary">Nhiệt độ mục tiêu</Text>
                    <Slider
                      min={30}
                      max={95}
                      step={1}
                      value={visibleTempSetpoint}
                      disabled={!isManualMode}
                      onChange={(value) => {
                        if (typeof value === 'number') {
                          setManualTempSetpoint(value);
                        }
                      }}
                      onChangeComplete={(value) => {
                        if (typeof value === 'number') {
                          void persistManualSetpoint({
                            manualTargetTemp: value,
                            manualTargetHumidity: manualHumiditySetpoint,
                          });
                        }
                      }}
                    />
                    <Text style={{ fontSize: 12 }}>
                      {Math.round(visibleTempSetpoint)}°C
                      {!isManualMode && autoTempSetpoint !== null
                        ? ` (từ ${currentStageSetpoint ? `giai đoạn ${currentStageSetpoint.stageOrder}` : 'công thức'} ${Math.round(autoTempSetpoint)}°C)`
                        : ''}
                    </Text>
                  </div>

                  <div>
                    <Text type="secondary">Độ ẩm mục tiêu</Text>
                    <Slider
                      min={5}
                      max={90}
                      step={1}
                      value={visibleHumiditySetpoint}
                      disabled={!isManualMode}
                      onChange={(value) => {
                        if (typeof value === 'number') {
                          setManualHumiditySetpoint(value);
                        }
                      }}
                      onChangeComplete={(value) => {
                        if (typeof value === 'number') {
                          void persistManualSetpoint({
                            manualTargetTemp: manualTempSetpoint,
                            manualTargetHumidity: value,
                          });
                        }
                      }}
                    />
                    <Text style={{ fontSize: 12 }}>
                      {Math.round(visibleHumiditySetpoint)}%
                      {!isManualMode && autoHumiditySetpoint !== null
                        ? ` (từ ${currentStageSetpoint ? `giai đoạn ${currentStageSetpoint.stageOrder}` : 'công thức'} ${Math.round(autoHumiditySetpoint)}%)`
                        : ''}
                    </Text>
                  </div>

                  {savingSetpoint && <Text type="secondary">Đang lưu setpoint...</Text>}
                </Space>
              </Card>
            </div>

            {isMaintenance && (
              <div style={{ textAlign: 'center', padding: '16px 0 6px' }}>
                <Tag color="warning" icon={<ToolOutlined />}>Thiết bị đang bảo trì</Tag>
              </div>
            )}

            <Divider style={{ margin: '12px 0 8px' }} />
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                Thông số cập nhật lúc{' '}
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString('vi', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '--:--:--'}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {isError && (
        <Alert
          style={{ marginTop: 16, borderRadius: 10 }}
          type="error"
          showIcon
          message="Cảnh báo trạng thái máy"
          description="Hệ thống đang đánh dấu máy trong trạng thái lỗi. Kiểm tra cảnh báo và xử lý trước khi vận hành tiếp."
          action={
            <Button size="small" danger icon={<ExclamationCircleOutlined />}>
              Đã tiếp nhận
            </Button>
          }
        />
      )}

      {heatLossDetected && isRunning && (
        <Alert
          style={{ marginTop: 16, borderRadius: 10 }}
          type="error"
          showIcon
          message="Cảnh báo thất thoát nhiệt"
          description={`Lux hiện tại (${effectiveLight ?? '--'}) vượt ngưỡng mở cửa (${DOOR_OPEN_LUX}) quá ${HEAT_LOSS_DELAY_MS / 1000} giây khi máy đang chạy.`}
        />
      )}
    </div>
  );
}
