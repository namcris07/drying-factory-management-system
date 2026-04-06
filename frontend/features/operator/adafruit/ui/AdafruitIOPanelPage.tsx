"use client";

/**
 * app/(operator)/operator/adafruit/page.tsx
 * Adafruit IO Panel
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Input,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  CloudServerOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdafruitIO } from '@/features/operator/adafruit/model/use-adafruit-io';
import { useOperatorContext } from '@/features/operator/model/operator-context';
import {
  AIO_CONFIG,
  getMachineFeeds,
} from '@/features/operator/adafruit/config/adafruit-config';
import { systemConfigApi } from '@/shared/lib/api';
import {
  DEFAULT_SYSTEM_THRESHOLDS,
  SystemThresholds,
  systemThresholdsFromRecord,
} from '@/shared/lib/system-thresholds';
import { OperatingModeToggle } from '@/features/operator/dashboard/ui/OperatingModeToggle';
const { Title, Text } = Typography;

type RuntimeThresholds = {
  tempMax: number;
  tempWarn: number;
  humMin: number;
  humMax: number;
  lightDoor: number;
};

function toRuntimeThresholds(config: SystemThresholds): RuntimeThresholds {
  return {
    tempMax: config.maxTempSafe,
    tempWarn: Math.max(0, config.maxTempSafe - 8),
    humMin: config.minHumidity,
    humMax: config.maxHumidity,
    lightDoor: config.lightSensorThreshold,
  };
}

function getTempStatus(t: number, thresholds: RuntimeThresholds): {
  color: string;
  label: string;
  tagColor: 'error' | 'warning' | 'success';
} {
  if (t >= thresholds.tempMax) {
    return { color: '#ff4d4f', label: 'NGUY HIEM', tagColor: 'error' };
  }
  if (t >= thresholds.tempWarn) {
    return { color: '#faad14', label: 'CANH BAO', tagColor: 'warning' };
  }
  return { color: '#52c41a', label: 'BINH THUONG', tagColor: 'success' };
}

function getHumStatus(h: number, thresholds: RuntimeThresholds): { color: string; label: string } {
  if (h < thresholds.humMin) return { color: '#faad14', label: 'Qua kho' };
  if (h > thresholds.humMax) return { color: '#faad14', label: 'Qua am' };
  return { color: '#52c41a', label: 'Binh thuong' };
}

function getLightStatus(lux: number, thresholds: RuntimeThresholds): {
  color: string;
  label: string;
  doorWarn: boolean;
} {
  if (lux > thresholds.lightDoor) {
    return {
      color: '#ff4d4f',
      label: `${lux} lux - Cua co the dang mo`,
      doorWarn: true,
    };
  }
  if (lux > 400) {
    return { color: '#faad14', label: `${lux} lux`, doorWarn: false };
  }
  return { color: '#52c41a', label: `${lux} lux`, doorWarn: false };
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

export default function AdafruitIOPanelPage() {
  const { message } = App.useApp();
  const { zone, machines } = useOperatorContext();
  const [thresholds, setThresholds] = useState<RuntimeThresholds>(
    toRuntimeThresholds(DEFAULT_SYSTEM_THRESHOLDS),
  );
  const [lcdInput, setLcdInput] = useState('');
  const [sendingLcd, setSendingLcd] = useState(false);
  const [operatingMode, setOperatingMode] = useState<'auto' | 'manual'>('auto');

  const zoneMachines = machines.filter(m => m.zone === zone);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const effectiveMachineId = selectedMachineId || zoneMachines[0]?.id || '';

  const feeds = effectiveMachineId ? getMachineFeeds(effectiveMachineId) : null;

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

  const tempSt = getTempStatus(sensor.temperature, thresholds);
  const humSt = getHumStatus(sensor.humidity, thresholds);
  const lightSt = getLightStatus(sensor.light, thresholds);

  useEffect(() => {
    let mounted = true;

    const loadThresholds = async () => {
      try {
        const config = await systemConfigApi.getAll();
        if (!mounted) return;
        const parsed = systemThresholdsFromRecord(config);
        setThresholds(toRuntimeThresholds(parsed));
        // Also load operating mode
        const mode = (config.operatingMode ?? 'auto') as 'auto' | 'manual';
        setOperatingMode(mode);
      } catch {
        if (!mounted) return;
        setThresholds(toRuntimeThresholds(DEFAULT_SYSTEM_THRESHOLDS));
      }
    };

    void loadThresholds();

    return () => {
      mounted = false;
    };
  }, []);

  // Poll for mode changes every 5 seconds to sync with other browsers
  useEffect(() => {
    const pollMode = async () => {
      try {
        const config = await systemConfigApi.getAll();
        const mode = (config.operatingMode ?? 'auto') as 'auto' | 'manual';
        setOperatingMode(mode);
      } catch {
        // Silent fail, keep current mode
      }
    };

    const interval = setInterval(pollMode, 5000);
    return () => clearInterval(interval);
  }, []);

  const feedRows = feeds
    ? [
        { label: 'Nhiệt độ (DHT20)', key: feeds.temperature, dir: 'IN' },
        { label: 'Độ ẩm (DHT20)', key: feeds.humidity, dir: 'IN' },
        { label: 'Ánh sáng (LDR)', key: feeds.light, dir: 'IN' },
        { label: 'Mức quạt', key: feeds.fanLevel, dir: 'OUT' },
        { label: 'LED (giả lập)', key: feeds.led, dir: 'OUT' },
        { label: 'LCD', key: feeds.lcd, dir: 'OUT' },
      ]
    : [];

  const handleSendLcd = async () => {
    if (!lcdInput.trim()) return;
    setSendingLcd(true);
    await sendLcd(lcdInput.trim().slice(0, 32));
    message.success(`Da gui len LCD: ${lcdInput.trim().slice(0, 32)}`);
    setSendingLcd(false);
    setLcdInput('');
  };

  const handleLedToggle = async (on: boolean) => {
    if (operatingMode === 'auto') {
      message.error(
        'Hệ thống đang chạy ở chế độ Auto. Không thể điều khiển thiết bị thủ công.'
      );
      return;
    }
    await setLed(on);
    message.info(`LED -> ${on ? 'BAT' : 'TAT'}`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <CloudServerOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Adafruit IO - Giám sát và Điều khiển
          </Title>
        </div>
        <Space wrap>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 20,
              background: connected ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${connected ? '#b7eb8f' : '#ffccc7'}`,
            }}
          >
            {connected ? (
              <>
                <Badge status="processing" color="#52c41a" />
                <Text style={{ fontSize: 12, color: '#52c41a', fontWeight: 600 }}>
                  LIVE
                </Text>
              </>
            ) : (
              <>
                <DisconnectOutlined style={{ color: '#ff4d4f' }} />
                <Text style={{ fontSize: 12, color: '#ff4d4f', fontWeight: 600 }}>
                  Chua ket noi
                </Text>
              </>
            )}
          </div>
          <Button icon={<ReloadOutlined spin={loading} />} onClick={refresh} size="small" style={{ borderRadius: 8 }}>
            Refresh
          </Button>
          <OperatingModeToggle onModeChange={setOperatingMode} />
        </Space>
      </div>

      {errorMsg && (
        <Alert
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16, borderRadius: 10 }}
          message="Loi ket noi"
          description={<Text style={{ fontSize: 13 }}>{errorMsg}</Text>}
        />
      )}

      <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: '14px 18px' } }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Text strong style={{ fontSize: 13 }}>Chọn máy sấy ({zone}):</Text>
          </Col>
          <Col xs={24} sm={16} md={10}>
            <Select
              value={effectiveMachineId || undefined}
              onChange={setSelectedMachineId}
              style={{ width: '100%' }}
              options={zoneMachines.map(m => ({
                value: m.id,
                label: `${m.id} - ${m.name} (${m.status})`,
              }))}
            />
          </Col>
          <Col xs={24} md={8}>
            {lastUpdated && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                Cập nhật: {lastUpdated.toLocaleTimeString('vi')} · Poll mỗi {AIO_CONFIG.pollingIntervalMs / 1000}s
              </Text>
            )}
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
            <Col xs={24} sm={8}>
              <Card
                style={{ borderRadius: 12, border: `2px solid ${tempSt.color}22`, background: `${tempSt.color}08` }}
                styles={{ body: { padding: '16px', textAlign: 'center' } }}
              >
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>Nhiệt độ (DHT20)</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: tempSt.color, lineHeight: 1, marginBottom: 4 }}>
                  {sensor.temperature > 0 ? sensor.temperature.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 13, color: tempSt.color, fontWeight: 600, marginBottom: 8 }}>°C</div>
                <Tag color={tempSt.tagColor} style={{ borderRadius: 12, fontSize: 11 }}>
                  {tempSt.label}
                </Tag>
              </Card>
            </Col>

            <Col xs={24} sm={8}>
              <Card
                style={{ borderRadius: 12, border: '2px solid #1677ff22', background: '#1677ff08' }}
                styles={{ body: { padding: '16px', textAlign: 'center' } }}
              >
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>Độ ẩm (DHT20)</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: '#1677ff', lineHeight: 1, marginBottom: 4 }}>
                  {sensor.humidity > 0 ? sensor.humidity.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 13, color: '#1677ff', fontWeight: 600, marginBottom: 8 }}>%</div>
                <Tag color={humSt.color === '#52c41a' ? 'success' : 'warning'} style={{ borderRadius: 12, fontSize: 11 }}>
                  {humSt.label}
                </Tag>
              </Card>
            </Col>

            <Col xs={24} sm={8}>
              <Card
                style={{
                  borderRadius: 12,
                  border: `2px solid ${lightSt.doorWarn ? '#ff4d4f' : '#faad14'}22`,
                  background: `${lightSt.doorWarn ? '#ff4d4f' : '#faad14'}08`,
                }}
                styles={{ body: { padding: '16px', textAlign: 'center' } }}
              >
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>Ánh sáng</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: lightSt.doorWarn ? '#ff4d4f' : '#faad14', lineHeight: 1, marginBottom: 4 }}>
                  {sensor.light > 0 ? sensor.light : '—'}
                </div>
                <div style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 600, marginBottom: 8 }}>lux</div>
                <Tag color={lightSt.doorWarn ? 'error' : 'warning'} style={{ borderRadius: 12, fontSize: 11 }}>
                  {lightSt.doorWarn ? 'Có thể cửa mở' : 'Bình thường'}
                </Tag>
              </Card>
            </Col>
          </Row>

          <Card
            style={{ borderRadius: 12, marginBottom: 14 }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Lịch sử cảm biến (30 điểm)</span>
                {connected && <Badge status="processing" text={<Text style={{ fontSize: 11 }}>Đang cập nhật</Text>} />}
              </div>
            }
          >
            {history.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis yAxisId="temp" tick={{ fontSize: 10 }} width={34} />
                  <YAxis yAxisId="hum" orientation="right" tick={{ fontSize: 10 }} width={34} />
                  <ChartTooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #f0f0f0', fontSize: 12 }}
                    formatter={(val: number, name: string) => {
                      if (name === 'temperature') return [`${val} °C`, 'Nhiệt độ'];
                      if (name === 'humidity') return [`${val}%`, 'Độ ẩm'];
                      return [`${val} lux`, 'Ánh sáng'];
                    }}
                  />
                  <Legend />
                  <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="#ff7a00" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="hum" type="monotone" dataKey="humidity" stroke="#1677ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">Đang thu thập dữ liệu...</Text>
              </div>
            )}
          </Card>

          <Collapse
            size="small"
            style={{ borderRadius: 10 }}
            items={[
              {
                key: 'feeds',
                label: (
                  <Space>
                    <ApiOutlined style={{ color: '#1677ff' }} />
                    <Text style={{ fontSize: 13 }}>
                      Feed Keys - {effectiveMachineId} ({feedRows.length} feeds)
                    </Text>
                  </Space>
                ),
                children: (
                  <div>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12, borderRadius: 8 }}
                      message="Danh sách feed đang map trong FE"
                    />
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#fafafa' }}>
                          {['Cam bien/Thiet bi', 'Feed Key', 'Huong'].map((h) => (
                            <th key={h} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, textAlign: 'left', border: '1px solid #f0f0f0' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {feedRows.map((row) => (
                          <tr key={row.key}>
                            <td style={{ padding: '7px 10px', fontSize: 13, border: '1px solid #f0f0f0' }}>{row.label}</td>
                            <td style={{ padding: '7px 10px', border: '1px solid #f0f0f0' }}>
                              <Text code style={{ fontSize: 11 }}>{row.key}</Text>
                            </td>
                            <td style={{ padding: '7px 10px', border: '1px solid #f0f0f0' }}>
                              <Tag color={row.dir === 'IN' ? 'blue' : 'orange'} style={{ borderRadius: 10, fontSize: 11 }}>
                                {row.dir === 'IN' ? 'INPUT' : 'OUTPUT'}
                              </Tag>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ),
              },
            ]}
          />
        </Col>

        <Col xs={24} lg={9}>
          <Card
            style={{ borderRadius: 14, marginBottom: 14 }}
            title={<span style={{ fontWeight: 600 }}>Điều khiển thiết bị đầu ra</span>}
          >
            <div style={{ marginBottom: 18, padding: '12px 16px', background: '#fafafa', borderRadius: 10, border: '1px solid #e8e8e8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text strong style={{ fontSize: 13 }}>Mức quạt</Text>
                <Tag color="processing">{output.fanLevel}%</Tag>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={output.fanLevel}
                disabled={operatingMode === 'auto'}
                onChange={(value) => {
                  if (operatingMode === 'auto') return;
                  void setFanLevel(value);
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, padding: '14px 16px', background: output.ledOn ? '#fff7e6' : '#fafafa', borderRadius: 10, border: `1px solid ${output.ledOn ? '#ffd591' : '#e8e8e8'}` }}>
              <div>
                <Text strong style={{ fontSize: 14 }}>LED giả lập</Text>
                <div>
                  <Tag color={output.ledOn ? 'warning' : 'default'} style={{ borderRadius: 10, fontSize: 11, marginTop: 4 }}>
                    {output.ledOn ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </Tag>
                </div>
              </div>
              <Tooltip title={operatingMode === 'auto' ? 'Bị khóa ở chế độ Auto' : ''}>
                <Switch 
                  checked={output.ledOn} 
                  onChange={(checked) => void handleLedToggle(checked)} 
                  checkedChildren="BẬT" 
                  unCheckedChildren="TẮT"
                  disabled={operatingMode === 'auto'}
                  style={{ opacity: operatingMode === 'auto' ? 0.5 : 1 }}
                />
              </Tooltip>
            </div>

            <div style={{ padding: '14px 16px', background: '#0a1628', borderRadius: 10, border: '1px solid #1a2a3a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Text strong style={{ fontSize: 13, color: '#fff' }}>LCD I2C</Text>
                <Tag color="geekblue" style={{ borderRadius: 10, fontSize: 10, marginLeft: 'auto' }}>OUTPUT</Tag>
              </div>

              <LcdDisplay message={output.lcdMessage} />

              <div style={{ marginTop: 10 }}>
                <Input
                  placeholder="Nhập nội dung LCD (tối đa 32 ký tự)..."
                  value={lcdInput}
                  onChange={(e) => setLcdInput(e.target.value.slice(0, 32))}
                  onPressEnter={() => void handleSendLcd()}
                  maxLength={32}
                  style={{ borderRadius: 8, marginBottom: 8 }}
                />
                <Button
                  type="primary"
                  block
                  icon={<SendOutlined />}
                  onClick={() => void handleSendLcd()}
                  loading={sendingLcd}
                  disabled={!lcdInput.trim()}
                  style={{ borderRadius: 8 }}
                >
                  Gửi lên LCD
                </Button>
              </div>
            </div>
          </Card>

        </Col>
      </Row>
    </div>
  );
}
