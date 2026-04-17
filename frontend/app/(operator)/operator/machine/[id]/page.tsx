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
  SendOutlined,
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
import { batchesApi, systemConfigApi } from '@/shared/lib/api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const DOOR_OPEN_LUX = AIO_THRESHOLDS.lightDoor;
const HEAT_LOSS_DELAY_MS = 20_000;
const SENSOR_FAULT_TEMP_MIN = 5;
const SENSOR_FAULT_TEMP_MAX = 120;

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

type PanelMode = 'overview' | 'sensors' | 'fans';

type SensorNode = {
  key: string;
  feed: string;
  sensorType: string;
  value: number | null;
  unit: string;
  updatedAt: string | null;
};

type DynamicFanComparator = 'gte' | 'lte';

type DynamicFanRule = {
  id: string;
  enabled: boolean;
  sensorFeed: string;
  comparator: DynamicFanComparator;
  threshold: number;
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
};

type DynamicFanRuleDraft = {
  sensorFeed: string;
  comparator: DynamicFanComparator;
  threshold: number;
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
};

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

function LcdDisplay({ message }: { message: string }) {
  const lines = (message || ' ')
    .padEnd(32, ' ')
    .match(/.{1,16}/g) || ['                '];

  return (
    <div
      style={{
        background: '#1a2a1a',
        borderRadius: 6,
        padding: '10px 14px',
        border: '2px solid #3d5c3d',
        fontFamily: '"Courier New", Courier, monospace',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
      }}
    >
      {lines.slice(0, 2).map((line, i) => (
        <div
          key={i}
          style={{
            color: '#7cfc00',
            fontSize: 14,
            letterSpacing: 2,
            lineHeight: '22px',
            minHeight: 22,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

export default function OperatorMachineDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const machineId = decodeURIComponent(params.id);
  const { message } = App.useApp();
  const [lcdInput, setLcdInput] = useState('');
  const [sendingLcd, setSendingLcd] = useState(false);
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
  const [fanLevelDraft, setFanLevelDraft] = useState(0);
  const [isAdjustingFan, setIsAdjustingFan] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('overview');
  const [dynamicFanRules, setDynamicFanRules] = useState<DynamicFanRule[]>([]);
  const [ruleDraft, setRuleDraft] = useState<DynamicFanRuleDraft>({
    sensorFeed: '',
    comparator: 'gte',
    threshold: 60,
    fanFeed: '',
    fanLevelOn: 70,
    fanLevelOff: 0,
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
    setLed,
    sendLcd,
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

  const rulesConfigKey = useMemo(
    () => `operatorFanRules.${machineId}`,
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
  const hasLedFeed = hasFeed(['led']);
  const hasFanFeed = hasFeed(['fan']);
  const hasLcdFeed = hasFeed(['lcd']);

  const sensorNodes = useMemo<SensorNode[]>(() => {
    const rows = machine?.sensorState ?? [];
    const mapped = rows.map((row) => {
      const numeric = Number(row.value);
      const value = Number.isFinite(numeric) ? Math.round(numeric * 10) / 10 : null;
      return {
        key: `${row.feed}-${row.sensorType}`,
        feed: row.feed,
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

  const sensorSummary = useMemo(() => {
    const total = sensorNodes.length;
    const hasRecent = sensorNodes.filter((row) => row.updatedAt).length;
    return {
      total,
      online: hasRecent,
      offline: Math.max(0, total - hasRecent),
    };
  }, [sensorNodes]);

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
          const sensorFeed = String(rule.sensorFeed ?? '').trim();
          const fanFeed = String(rule.fanFeed ?? '').trim();
          if (!sensorFeed || !fanFeed) return null;

          return {
            id: String(rule.id ?? `rule-${index + 1}`),
            enabled: Boolean(rule.enabled),
            sensorFeed,
            comparator,
            threshold: Number.isFinite(threshold) ? threshold : 0,
            fanFeed,
            fanLevelOn: Number.isFinite(fanLevelOn) ? Math.max(0, Math.min(100, fanLevelOn)) : 70,
            fanLevelOff: Number.isFinite(fanLevelOff) ? Math.max(0, Math.min(100, fanLevelOff)) : 0,
          } as DynamicFanRule;
        })
        .filter((rule): rule is DynamicFanRule => Boolean(rule));
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
    if (isAdjustingFan) return;
    setFanLevelDraft(hasFanFeed ? output.fanLevel : 0);
  }, [hasFanFeed, isAdjustingFan, output.fanLevel]);

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
        const loadedRules = parseDynamicRules(cfg[rulesConfigKey]);

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
      } catch {
        // Keep local defaults if config endpoint is temporarily unavailable.
      }
    };

    void loadModeAndSetpoints();

    return () => {
      mounted = false;
    };
  }, [rulesConfigKey]);

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

  const persistDynamicRules = async (
    nextRules: DynamicFanRule[],
    options?: { silent?: boolean },
  ) => {
    setSavingRules(true);
    try {
      await systemConfigApi.saveAll({
        [rulesConfigKey]: JSON.stringify(nextRules),
      });
      if (!options?.silent) {
        message.success('Đã lưu rule động cho quạt.');
      }
    } catch {
      message.error('Không thể lưu rule động của quạt.');
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

    setIsAdjustingFan(true);
    setFanLevelDraft(manualRecommendedFanLevel);
    const ok = await setFanLevel(manualRecommendedFanLevel);
    setIsAdjustingFan(false);

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
  const handleLedToggle = async (on: boolean) => {
    if (!hasLedFeed) {
      message.warning('Thiết bị chưa cấu hình feed LED.');
      return;
    }
    if (!isManualMode) {
      message.warning('Chế độ Auto: không thể điều khiển LED thủ công.');
      return;
    }
    const ok = await setLed(on);
    if (ok) {
      message.info(`LED -> ${on ? 'BẬT' : 'TẮT'}`);
      return;
    }

    message.error('Không đồng bộ được lệnh LED lên Adafruit IO.');
  };

  const handleSendLcd = async () => {
    if (!hasLcdFeed) {
      message.warning('Thiết bị chưa cấu hình feed LCD.');
      return;
    }
    if (!isManualMode) {
      message.warning('Chỉ có thể gửi tin nhắn LCD tùy chỉnh trong chế độ Manual.');
      return;
    }
    if (!lcdInput.trim()) {
      message.warning('Vui lòng nhập nội dung LCD.');
      return;
    }
    setSendingLcd(true);
    const ok = await sendLcd(lcdInput.trim().slice(0, 32));
    if (ok) {
      message.success(`Đã gửi lên LCD: ${lcdInput.trim().slice(0, 32)}`);
    } else {
      message.error('Không đồng bộ được nội dung LCD lên Adafruit IO.');
    }
    setSendingLcd(false);
    setLcdInput('');
  };

  const handleQuickFanAction = async (nextLevel: number) => {
    if (!hasFanFeed) {
      message.warning('Buồng sấy chưa cấu hình feed quạt điều khiển.');
      return;
    }
    if (!isManualMode) {
      message.warning('Chỉ điều khiển quạt nhanh trong chế độ Manual.');
      return;
    }

    setIsAdjustingFan(true);
    setFanLevelDraft(nextLevel);
    const ok = await setFanLevel(nextLevel);
    setIsAdjustingFan(false);

    if (ok) {
      message.success(`Đã áp dụng quạt chính ${nextLevel}%.`);
      return;
    }
    message.error('Không đồng bộ được lệnh quạt nhanh.');
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
      sensorFeed,
      comparator: ruleDraft.comparator,
      threshold: Number(ruleDraft.threshold),
      fanFeed,
      fanLevelOn: Math.max(0, Math.min(100, Number(ruleDraft.fanLevelOn))),
      fanLevelOff: Math.max(0, Math.min(100, Number(ruleDraft.fanLevelOff))),
    };

    const nextRules = [...dynamicFanRules, nextRule];
    setDynamicFanRules(nextRules);
    await persistDynamicRules(nextRules);
  };

  const handleToggleDynamicRule = async (id: string, enabled: boolean) => {
    const nextRules = dynamicFanRules.map((rule) =>
      rule.id === id ? { ...rule, enabled } : rule,
    );
    setDynamicFanRules(nextRules);
    await persistDynamicRules(nextRules, { silent: true });
  };

  const handleDeleteDynamicRule = async (id: string) => {
    const nextRules = dynamicFanRules.filter((rule) => rule.id !== id);
    setDynamicFanRules(nextRules);
    await persistDynamicRules(nextRules);
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
                  { label: 'Quạt', value: 'fans' },
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

                            return (
                            <Col xs={24} md={12} xl={8} key={row.key}>
                              <Card
                                size='small'
                                style={
                                  pulseDanger
                                    ? {
                                        borderColor: '#ff4d4f',
                                        boxShadow: '0 0 0 2px rgba(255,77,79,0.18), 0 0 18px rgba(255,77,79,0.28)',
                                      }
                                    : undefined
                                }
                              >
                                <Space direction='vertical' size={2} style={{ width: '100%' }}>
                                  <Text strong>{toSensorLabel(row.sensorType)}</Text>
                                  <Text type='secondary'>{row.feed}</Text>
                                  <Text>
                                    {row.value ?? '--'} {row.unit}
                                  </Text>
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

              {panelMode === 'fans' ? (
                <Space direction='vertical' size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <Button
                      size='small'
                      disabled={!isManualMode || !hasFanFeed}
                      loading={isAdjustingFan}
                      onClick={() => void handleQuickFanAction(30)}
                    >
                      Quạt 30%
                    </Button>
                    <Button
                      size='small'
                      disabled={!isManualMode || !hasFanFeed}
                      loading={isAdjustingFan}
                      onClick={() => void handleQuickFanAction(60)}
                    >
                      Quạt 60%
                    </Button>
                    <Button
                      size='small'
                      disabled={!isManualMode || !hasFanFeed}
                      loading={isAdjustingFan}
                      onClick={() => void handleQuickFanAction(100)}
                    >
                      Quạt 100%
                    </Button>
                    <Button
                      size='small'
                      danger
                      disabled={!isManualMode || !hasFanFeed}
                      loading={isAdjustingFan}
                      onClick={() => void handleQuickFanAction(0)}
                    >
                      Tắt quạt
                    </Button>
                  </Space>

                  <Card size='small' title='Rule động cảm biến -> quạt'>
                    <Space direction='vertical' size={10} style={{ width: '100%' }}>
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
                            placeholder='Chọn quạt đích'
                            value={ruleDraft.fanFeed || undefined}
                            options={fanRuleOptions}
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
                        <Col xs={24} md={8}>
                          <Button
                            type='primary'
                            block
                            loading={savingRules}
                            onClick={() => void handleAddDynamicRule()}
                          >
                            Thêm rule động
                          </Button>
                        </Col>
                      </Row>

                      {dynamicFanRules.length === 0 ? (
                        <Empty description='Chưa có rule động cho quạt' image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ) : (
                        <Space direction='vertical' size={8} style={{ width: '100%' }}>
                          {dynamicFanRules.map((rule) => (
                            <Card size='small' key={rule.id}>
                              <Row gutter={[8, 8]} align='middle'>
                                <Col xs={24} md={16}>
                                  <Space size={8} wrap>
                                    <Tag color={rule.enabled ? 'green' : 'default'}>{rule.id}</Tag>
                                    <Text>{rule.sensorFeed}</Text>
                                    <Tag>{rule.comparator}</Tag>
                                    <Tag color='orange'>{rule.threshold}</Tag>
                                    <Text>{'->'}</Text>
                                    <Text>{rule.fanFeed}</Text>
                                    <Tag color='blue'>ON {rule.fanLevelOn}%</Tag>
                                    <Tag>OFF {rule.fanLevelOff}%</Tag>
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
                    </Space>
                  </Card>

                  {fanNodes.length === 0 ? (
                    <Empty description='Chưa phát hiện node quạt trong cấu hình hiện tại' />
                  ) : (
                    <Row gutter={[12, 12]}>
                      {fanNodes.map((fan, index) => (
                        <Col xs={24} md={12} xl={8} key={fan.key}>
                          <Card size='small'>
                            <Space direction='vertical' size={2} style={{ width: '100%' }}>
                              <Text strong>{fan.name}</Text>
                              <Text type='secondary'>{fan.feed}</Text>
                              <Text>
                                {Number.isFinite(Number(fan.level)) ? Number(fan.level).toFixed(1) : '--'}%
                              </Text>
                              <Text type='secondary' style={{ fontSize: 12 }}>
                                {fan.updatedAt
                                  ? dayjs(fan.updatedAt).format('HH:mm:ss DD/MM')
                                  : 'Theo trạng thái output'}
                              </Text>
                              {index === 0 ? <Tag color='blue'>Quạt điều khiển chính</Tag> : <Tag>Theo dõi</Tag>}
                            </Space>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
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

              <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                Điều khiển thiết bị
              </Text>
              <Row gutter={[10, 10]}>
                <Col span={12}>
                  <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: 12 } }}>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Text strong>
                        LED
                      </Text>
                      <Switch
                        checked={hasLedFeed ? output.ledOn : false}
                        disabled={!isManualMode || !hasLedFeed}
                        onChange={(checked) => void handleLedToggle(checked)}
                      />
                      {!hasLedFeed && <Text type="secondary" style={{ fontSize: 11 }}>Chưa cấu hình LED feed</Text>}
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: 12 } }}>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Text strong>
                        Quạt
                      </Text>
                      <Tag color={output.fanOn ? 'success' : 'default'}>
                        {!hasFanFeed ? 'Chưa cấu hình' : output.fanOn ? 'Đang chạy' : 'Đang tắt'}
                      </Tag>
                    </Space>
                  </Card>
                </Col>
                <Col span={24}>
                  <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: 12 } }}>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Tốc độ quạt</Text>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={fanLevelDraft}
                      disabled={!isManualMode || !hasFanFeed}
                      onChange={(value) => {
                        if (!isManualMode || !hasFanFeed) return;
                        if (typeof value !== 'number') return;
                        setIsAdjustingFan(true);
                        setFanLevelDraft(value);
                      }}
                      onChangeComplete={(value) => {
                        if (!isManualMode || !hasFanFeed) return;
                        if (typeof value !== 'number') return;
                        void setFanLevel(value).finally(() => {
                          setIsAdjustingFan(false);
                        });
                      }}
                    />
                    <Text type="secondary">
                      {hasFanFeed ? `Mức hiện tại: ${fanLevelDraft}%` : 'Chưa cấu hình feed quạt'}
                    </Text>
                  </Card>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 10 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>LCD Message</Text>
              <div style={{ padding: '14px 16px', background: '#0a1628', borderRadius: 10, border: '1px solid #1a2a3a', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 13, color: '#fff' }}>LCD I2C</Text>
                  <Tag color="geekblue" style={{ borderRadius: 10, fontSize: 10, marginLeft: 'auto' }}>OUTPUT</Tag>
                </div>
                <LcdDisplay message={output.lcdMessage} />
              </div>
              {isManualMode && hasLcdFeed ? (
                <>
                  <TextArea
                    rows={3}
                    placeholder="Nhập tối đa 32 ký tự..."
                    value={lcdInput}
                    onChange={(e) => setLcdInput(e.target.value)}
                    maxLength={64}
                    style={{ borderRadius: 8, marginBottom: 8 }}
                  />
                  <Button
                    block
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => void handleSendLcd()}
                    loading={sendingLcd}
                    style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
                  >
                    Gửi LCD
                  </Button>
                </>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {hasLcdFeed ? 'Chỉ chỉnh LCD ở chế độ Manual.' : 'Chưa cấu hình feed LCD.'}
                </Text>
              )}
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
