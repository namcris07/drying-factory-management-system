"use client";

/**
 * app/(operator)/operator/adafruit/page.tsx
 * Adafruit IO Panel
 */
import { useState } from 'react';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
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
  CodeOutlined,
  DisconnectOutlined,
  ReloadOutlined,
  SendOutlined,
  WifiOutlined,
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
  AIO_THRESHOLDS,
  getMachineFeeds,
} from '@/features/operator/adafruit/config/adafruit-config';

const { Title, Text, Paragraph } = Typography;

function getTempStatus(t: number): {
  color: string;
  label: string;
  tagColor: 'error' | 'warning' | 'success';
} {
  if (t >= AIO_THRESHOLDS.tempMax) {
    return { color: '#ff4d4f', label: 'NGUY HIEM', tagColor: 'error' };
  }
  if (t >= AIO_THRESHOLDS.tempWarn) {
    return { color: '#faad14', label: 'CANH BAO', tagColor: 'warning' };
  }
  return { color: '#52c41a', label: 'BINH THUONG', tagColor: 'success' };
}

function getHumStatus(h: number): { color: string; label: string } {
  if (h < AIO_THRESHOLDS.humMin) return { color: '#faad14', label: 'Qua kho' };
  if (h > AIO_THRESHOLDS.humMax) return { color: '#faad14', label: 'Qua am' };
  return { color: '#52c41a', label: 'Binh thuong' };
}

function getLightStatus(lux: number): {
  color: string;
  label: string;
  doorWarn: boolean;
} {
  if (lux > AIO_THRESHOLDS.lightDoor) {
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
  const [lcdInput, setLcdInput] = useState('');
  const [sendingLcd, setSendingLcd] = useState(false);

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
    setFan,
    setFanLevel,
    setRelay,
    sendLcd,
    refresh,
  } = useAdafruitIO(feeds);

  const tempSt = getTempStatus(sensor.temperature);
  const humSt = getHumStatus(sensor.humidity);
  const lightSt = getLightStatus(sensor.light);

  const isUnconfigured = AIO_CONFIG.username === 'YOUR_AIO_USERNAME';

  const feedRows = feeds
    ? [
        { label: 'Nhiet do (DHT20)', key: feeds.temperature, dir: 'IN' },
        { label: 'Do am (DHT20)', key: feeds.humidity, dir: 'IN' },
        { label: 'Anh sang (LDR)', key: feeds.light, dir: 'IN' },
        { label: 'Quat lam mat', key: feeds.fan, dir: 'OUT' },
        { label: 'Level quat', key: feeds.fanLevel, dir: 'OUT' },
        { label: 'Relay', key: feeds.relay, dir: 'OUT' },
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

  const handleFanToggle = async (on: boolean) => {
    await setFan(on);
    message.info(`Quat -> ${on ? 'BAT' : 'TAT'}`);
  };

  const handleRelayToggle = async (on: boolean) => {
    await setRelay(on);
    message.info(`Relay -> ${on ? 'DONG' : 'NGAT'}`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <CloudServerOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Adafruit IO - Giam sat va Dieu khien
          </Title>
          <Text type="secondary">
            DHT20 (nhiet do, do am) - Anh sang - Quat - Relay - LCD
          </Text>
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
            <Text strong style={{ fontSize: 13 }}>Chon may say ({zone}):</Text>
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
                Cap nhat: {lastUpdated.toLocaleTimeString('vi')} · Poll moi {AIO_CONFIG.pollingIntervalMs / 1000}s
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
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>Nhiet do (DHT20)</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: tempSt.color, lineHeight: 1, marginBottom: 4 }}>
                  {sensor.temperature > 0 ? sensor.temperature.toFixed(1) : '—'}
                </div>
                <div style={{ fontSize: 13, color: tempSt.color, fontWeight: 600, marginBottom: 8 }}>degC</div>
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
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>Do am (DHT20)</div>
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
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 6 }}>Anh sang</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: lightSt.doorWarn ? '#ff4d4f' : '#faad14', lineHeight: 1, marginBottom: 4 }}>
                  {sensor.light > 0 ? sensor.light : '—'}
                </div>
                <div style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 600, marginBottom: 8 }}>lux</div>
                <Tag color={lightSt.doorWarn ? 'error' : 'warning'} style={{ borderRadius: 12, fontSize: 11 }}>
                  {lightSt.doorWarn ? 'Co the cua mo' : 'Binh thuong'}
                </Tag>
              </Card>
            </Col>
          </Row>

          <Card
            style={{ borderRadius: 12, marginBottom: 14 }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Lich su cam bien (30 diem)</span>
                {connected && <Badge status="processing" text={<Text style={{ fontSize: 11 }}>Dang cap nhat</Text>} />}
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
                      if (name === 'temperature') return [`${val} degC`, 'Nhiet do'];
                      if (name === 'humidity') return [`${val}%`, 'Do am'];
                      return [`${val} lux`, 'Anh sang'];
                    }}
                  />
                  <Legend />
                  <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="#ff7a00" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="hum" type="monotone" dataKey="humidity" stroke="#1677ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">Dang thu thap du lieu...</Text>
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
                      message="Danh sach feed dang map trong FE"
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
            title={<span style={{ fontWeight: 600 }}>Dieu khien thiet bi dau ra</span>}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, padding: '14px 16px', background: output.fanOn ? '#f6ffed' : '#fafafa', borderRadius: 10, border: `1px solid ${output.fanOn ? '#b7eb8f' : '#e8e8e8'}` }}>
              <div>
                <Text strong style={{ fontSize: 14 }}>Quat lam mat</Text>
                <div>
                  <Tag color={output.fanOn ? 'success' : 'default'} style={{ borderRadius: 10, fontSize: 11, marginTop: 4 }}>
                    {output.fanOn ? 'DANG CHAY' : 'TAT'}
                  </Tag>
                </div>
              </div>
              <Switch checked={output.fanOn} onChange={(checked) => void handleFanToggle(checked)} checkedChildren="BAT" unCheckedChildren="TAT" />
            </div>

            <div style={{ marginBottom: 18, padding: '12px 16px', background: '#fafafa', borderRadius: 10, border: '1px solid #e8e8e8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text strong style={{ fontSize: 13 }}>Level quat</Text>
                <Tag color="processing">{output.fanLevel}</Tag>
              </div>
              <Slider min={0} max={5} step={1} value={output.fanLevel} onChange={(value) => void setFanLevel(value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, padding: '14px 16px', background: output.relayOn ? '#fff7e6' : '#fafafa', borderRadius: 10, border: `1px solid ${output.relayOn ? '#ffd591' : '#e8e8e8'}` }}>
              <div>
                <Text strong style={{ fontSize: 14 }}>Relay</Text>
                <div>
                  <Tag color={output.relayOn ? 'warning' : 'default'} style={{ borderRadius: 10, fontSize: 11, marginTop: 4 }}>
                    {output.relayOn ? 'DONG MACH' : 'NGAT MACH'}
                  </Tag>
                </div>
              </div>
              <Switch checked={output.relayOn} onChange={(checked) => void handleRelayToggle(checked)} checkedChildren="DONG" unCheckedChildren="NGAT" />
            </div>

            <div style={{ padding: '14px 16px', background: '#0a1628', borderRadius: 10, border: '1px solid #1a2a3a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Text strong style={{ fontSize: 13, color: '#fff' }}>LCD I2C</Text>
                <Tag color="geekblue" style={{ borderRadius: 10, fontSize: 10, marginLeft: 'auto' }}>OUTPUT</Tag>
              </div>

              <LcdDisplay message={output.lcdMessage} />

              <div style={{ marginTop: 10 }}>
                <Input
                  placeholder="Nhap noi dung LCD (toi da 32 ky tu)..."
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
                  Gui len LCD
                </Button>
              </div>
            </div>
          </Card>

          <Card
            style={{ borderRadius: 14, marginBottom: 14 }}
            title={
              <Space>
                <WifiOutlined style={{ color: connected ? '#52c41a' : '#8c8c8c' }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Thong tin ket noi</span>
              </Space>
            }
            styles={{ body: { padding: '14px 16px' } }}
          >
            {[
              { label: 'Username', value: AIO_CONFIG.username, mono: true },
              { label: 'API Key', value: isUnconfigured ? 'Chua cau hinh' : '••••••••••••••••', mono: true },
              { label: 'Base URL', value: AIO_CONFIG.baseUrl, mono: true },
              { label: 'Poll Interval', value: `${AIO_CONFIG.pollingIntervalMs / 1000}s`, mono: false },
              { label: 'Rate Limit', value: `${AIO_CONFIG.maxRatePerMinute} req/phut`, mono: false },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{row.label}</Text>
                {row.mono ? (
                  <Text code style={{ fontSize: 11, textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</Text>
                ) : (
                  <Text style={{ fontSize: 12 }}>{row.value}</Text>
                )}
              </div>
            ))}
          </Card>

          <Collapse
            size="small"
            style={{ borderRadius: 10 }}
            items={[
              {
                key: 'guide',
                label: (
                  <Space>
                    <CodeOutlined style={{ color: '#722ed1' }} />
                    <Text style={{ fontSize: 13 }}>Huong dan test nhanh</Text>
                  </Space>
                ),
                children: (
                  <div style={{ fontSize: 12 }}>
                    <Paragraph style={{ fontSize: 12, marginBottom: 10 }}>
                      1. Chon may → xem so lieu cam bien cap nhat theo poll interval.
                    </Paragraph>
                    <Paragraph style={{ fontSize: 12, marginBottom: 10 }}>
                      2. Bat/tat quat, relay, gui LCD de test chieu App → Adafruit.
                    </Paragraph>
                    <Paragraph style={{ fontSize: 12, marginBottom: 10 }}>
                      3. Thay doi feed tren Adafruit dashboard de test chieu Adafruit → App.
                    </Paragraph>
                    <Divider style={{ margin: '10px 0' }} />
                    <Tooltip title="Kiem tra /api/mqtt/status neu du lieu khong nhay">
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Neu khong realtime, kiem tra MQTT status va feed mapping.
                      </Text>
                    </Tooltip>
                  </div>
                ),
              },
            ]}
          />
        </Col>
      </Row>
    </div>
  );
}
