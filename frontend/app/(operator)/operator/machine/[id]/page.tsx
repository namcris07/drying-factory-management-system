"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Input,
  Progress,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  ExclamationCircleOutlined,
  BookOutlined,
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
import { getMachineFeeds } from '@/features/operator/adafruit/config/adafruit-config';
import { useAdafruitIO } from '@/features/operator/adafruit/model/use-adafruit-io';
import { OperatingModeToggle } from '@/features/operator/dashboard/ui/OperatingModeToggle';
import { batchesApi, systemConfigApi } from '@/shared/lib/api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const DOOR_OPEN_LUX = AIO_THRESHOLDS.lightDoor;
const HEAT_LOSS_DELAY_MS = 20_000;

type StageSetpoint = {
  stageOrder: number;
  temperatureSetpoint: number;
  humiditySetpoint: number;
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
  Error: { text: ' lỗi', tagColor: 'error' },
  Maintenance: { text: 'Bảo trì', tagColor: 'warning' },
};

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
  const [currentBatchStage, setCurrentBatchStage] = useState<number | null>(null);
  const [currentStageSetpoint, setCurrentStageSetpoint] = useState<StageSetpoint | null>(null);
  const [pendingManualStageOrder, setPendingManualStageOrder] = useState<number | null>(null);
  const [fanLevelDraft, setFanLevelDraft] = useState(0);
  const [isAdjustingFan, setIsAdjustingFan] = useState(false);
  const doorOpenSinceRef = useRef<number | null>(null);
  const heatLossNotifiedRef = useRef(false);
  const lastSeenStageRef = useRef<number | null>(null);

  const { machines, zone, recipes, setMachines } = useOperatorContext();

  const machine = useMemo(
    () => machines.find((item) => item.id === machineId),
    [machines, machineId],
  );

  const feeds = useMemo(() => getMachineFeeds(machineId), [machineId]);
  const deviceId = useMemo(() => inferDeviceId(machineId), [machineId]);

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
  } = useAdafruitIO(feeds);

  const configuredFeedKeys = useMemo(() => {
    return new Set(
      (machine?.sensorFeeds ?? [])
        .map((feed) => normalizeFeedName(String(feed ?? '').trim()))
        .filter(Boolean),
    );
  }, [machine?.sensorFeeds]);

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

  const elapsed = (() => {
    if (!machine?.startTime) return '--';
    const [h, m] = machine.startTime.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '--';

    const startedAt = new Date();
    startedAt.setHours(h, m, 0, 0);
    const diffMs = nowSnapshot - startedAt.getTime();
    if (diffMs < 0) return '--';

    const dh = Math.floor(diffMs / 3600000);
    const dm = Math.floor((diffMs % 3600000) / 60000);
    return `${dh}h ${dm}m`;
  })();

  const elapsedMsSnapshot = (() => {
    if (!machine?.startTime) return 0;
    const [h, m] = machine.startTime.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;

    const startedAt = new Date();
    startedAt.setHours(h, m, 0, 0);
    return Math.max(0, nowSnapshot - startedAt.getTime());
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
    if (!machine?.startTime || !activeRecipe?.duration) {
      return typeof machine?.progress === 'number' ? machine.progress : undefined;
    }

    const [h, m] = machine.startTime.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return typeof machine.progress === 'number' ? machine.progress : undefined;
    }

    const elapsedMs = elapsedMsSnapshot;
    if (elapsedMs <= 0) return 0;

    const durationMs = activeRecipe.duration * 60 * 60 * 1000;
    if (durationMs <= 0) return typeof machine.progress === 'number' ? machine.progress : undefined;

    return Math.max(0, Math.min(100, Math.round((elapsedMs / durationMs) * 100)));
  }, [activeRecipe?.duration, elapsedMsSnapshot, machine?.progress, machine?.startTime]);

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
          lastSeenStageRef.current = null;
          setActiveBatchId(null);
          setCurrentBatchStage(null);
          setCurrentStageSetpoint(null);
          setPendingManualStageOrder(null);
          return;
        }

        setActiveBatchId(activeBatch.batchesID);
        const stageOrder = activeBatch.currentStage ?? null;
        setCurrentBatchStage(stageOrder);

        const detail = await batchesApi.getOne(activeBatch.batchesID);
        if (!mounted) return;

        const stages = detail.recipe?.stages ?? [];
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

        if (Number.isFinite(temp)) {
          setManualTempSetpoint(Math.max(30, Math.min(95, temp)));
        }
        if (Number.isFinite(humidity)) {
          setManualHumiditySetpoint(Math.max(5, Math.min(90, humidity)));
        }
      } catch {
        // Keep local defaults if config endpoint is temporarily unavailable.
      }
    };

    void loadModeAndSetpoints();

    return () => {
      mounted = false;
    };
  }, []);

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

    if (!deviceId) {
      message.warning('Không xác định được DeviceID để khởi động mẻ sấy.');
      return;
    }

    try {
      const createdBatch = await batchesApi.create({
        recipeID: selectedRecipe.id,
        deviceID: deviceId,
        operationMode: operatingMode,
        startTime: new Date().toISOString(),
      });
      setActiveBatchId(createdBatch.batchesID);

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

      message.success(`Da khoi dong nhanh me say: ${selectedRecipe.name}.`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Khoi dong me say that bai.');
    }
  };

  const handleStopBatch = async () => {
    try {
      if (activeBatchId) {
        await batchesApi.update(activeBatchId, {
          batchStatus: 'Stopped',
          batchResult: 'StoppedByOperator',
        });
        setActiveBatchId(null);
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

  const handleLedToggle = async (on: boolean) => {
    if (!hasLedFeed) {
      message.warning('Thiết bị chưa cấu hình feed LED.');
      return;
    }
    if (!isManualMode) {
      message.warning('Chế độ Auto: không thể điều khiển LED thủ công.');
      return;
    }
    await setLed(on);
    message.info(`LED -> ${on ? 'BẬT' : 'TẮT'}`);
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
    await sendLcd(lcdInput.trim().slice(0, 32));
    message.success(`Da gui len LCD: ${lcdInput.trim().slice(0, 32)}`);
    setSendingLcd(false);
    setLcdInput('');
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
          message="Canh bao ket noi"
          description={errorMsg}
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
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Diễn biến nhiệt độ & độ ẩm</span>
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
            <Row gutter={10} style={{ marginBottom: 18 }}>
              <Col span={12}>
                <div
                  style={{
                    background: 'rgba(255,122,0,0.09)',
                    borderRadius: 12,
                    padding: '14px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Nhiệt độ</div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: '#ff7a00', lineHeight: 1 }}>
                    {effectiveTemperature !== null ? effectiveTemperature.toFixed(1) : '--'}
                  </div>
                  <div style={{ fontSize: 14, color: '#ff7a00', fontWeight: 600 }}>°C</div>
                </div>
              </Col>
              <Col span={12}>
                <div
                  style={{
                    background: 'rgba(22,119,255,0.09)',
                    borderRadius: 12,
                    padding: '14px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Độ ẩm</div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: '#1677ff', lineHeight: 1 }}>
                    {effectiveHumidity !== null ? effectiveHumidity.toFixed(1) : '--'}
                  </div>
                  <div style={{ fontSize: 14, color: '#1677ff', fontWeight: 600 }}>%</div>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '0 0 16px' }} />

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
                    label: `${recipe.name} - ${recipe.temp}°C · ${recipe.duration}h`,
                  }))}
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
                      <Text type="secondary" style={{ fontSize: 12 }}>Thời lượng: {selectedRecipe.duration}h</Text>
                    </div>
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
                {new Date().toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })}
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
