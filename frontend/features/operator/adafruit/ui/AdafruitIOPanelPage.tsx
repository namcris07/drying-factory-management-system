"use client";

/**
 * app/(operator)/operator/adafruit/page.tsx
 * Adafruit IO Panel
 */
import { Typography, Card, Row, Col, Button, Tag, Space, Switch, Statistic, Alert, Select } from 'antd';
import { CloudServerOutlined, ThunderboltOutlined, BulbOutlined, ReloadOutlined, WifiOutlined } from '@ant-design/icons';
import { useAdafruitIO } from '@/features/operator/adafruit/model/use-adafruit-io';
import { useOperatorContext } from '@/features/operator/model/operator-context';
import { getMachineFeeds } from '@/features/operator/adafruit/config/adafruit-config';
import { useState, useMemo } from 'react';

const { Title, Text } = Typography;

export default function AdafruitIOPanelPage() {
  const { zone, machines } = useOperatorContext();
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  
  // Get feeds for selected machine
  const feeds = useMemo(() => {
    if (!selectedMachineId) return null;
    return getMachineFeeds(selectedMachineId);
  }, [selectedMachineId]);
  
  const { sensor, output, history, loading, connected, errorMsg, lastUpdated, setFan, setRelay, sendLcd, refresh } = useAdafruitIO(feeds);

  // Get machines in current zone
  const zoneMachines = machines.filter(m => m.zone === zone);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <CloudServerOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            Adafruit IO Panel
          </Title>
          <Text type="secondary">Điều khiển và giám sát thiết bị IoT qua Adafruit IO</Text>
        </div>
        <Space>
          <Select
            placeholder="Chọn máy sấy"
            style={{ width: 200 }}
            value={selectedMachineId}
            onChange={setSelectedMachineId}
            options={zoneMachines.map(m => ({
              value: m.id,
              label: `${m.name} (${m.status})`,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading} disabled={!selectedMachineId}>
            Làm mới
          </Button>
        </Space>
      </div>

      {/* Connection Status */}
      <Card style={{ marginBottom: 16, borderRadius: 12 }}>
        <Space size="large">
          <Space>
            <WifiOutlined style={{ color: connected ? '#52c41a' : '#ff4d4f' }} />
            <Text>Trạng thái: <Tag color={connected ? 'success' : 'error'}>{connected ? 'Đã kết nối' : 'Mất kết nối'}</Tag></Text>
          </Space>
          {lastUpdated && (
            <Text type="secondary">
              Cập nhật lần cuối: {lastUpdated.toLocaleTimeString('vi')}
            </Text>
          )}
        </Space>
      </Card>

      {errorMsg && (
        <Alert message="Lỗi kết nối" description={errorMsg} type="error" showIcon style={{ marginBottom: 24 }} />
      )}

      {!selectedMachineId ? (
        <Alert message="Vui lòng chọn máy sấy" description="Chọn một máy sấy từ dropdown phía trên để xem và điều khiển thiết bị IoT." type="info" showIcon />
      ) : (
        <>
          {/* Sensor Data */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, borderTop: '4px solid #ff7a00' }}>
                <Statistic
                  title="🌡️ Nhiệt độ"
                  value={sensor.temperature || 0}
                  precision={1}
                  suffix="°C"
                  valueStyle={{ color: '#ff7a00', fontSize: 40 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, borderTop: '4px solid #1677ff' }}>
                <Statistic
                  title="💧 Độ ẩm"
                  value={sensor.humidity || 0}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: '#1677ff', fontSize: 40 }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12, borderTop: '4px solid #52c41a' }}>
                <Statistic
                  title="💡 Ánh sáng"
                  value={sensor.light || 0}
                  suffix="lux"
                  valueStyle={{ color: '#52c41a', fontSize: 40 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Control Panel */}
          <Card title="Điều khiển thiết bị" style={{ borderRadius: 12 }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={8}>
                <Card style={{ borderRadius: 12, textAlign: 'center' }}>
                  <ThunderboltOutlined style={{ fontSize: 40, color: output.fanOn ? '#52c41a' : '#d9d9d9', marginBottom: 16 }} />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Quạt</Text>
                    <Switch checked={output.fanOn} onChange={setFan} />
                    <Tag color={output.fanOn ? 'success' : 'default'} style={{ marginLeft: 8 }}>
                      {output.fanOn ? 'BẬT' : 'TẮT'}
                    </Tag>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card style={{ borderRadius: 12, textAlign: 'center' }}>
                  <BulbOutlined style={{ fontSize: 40, color: output.relayOn ? '#faad14' : '#d9d9d9', marginBottom: 16 }} />
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>Relay</Text>
                    <Switch checked={output.relayOn} onChange={setRelay} />
                    <Tag color={output.relayOn ? 'warning' : 'default'} style={{ marginLeft: 8 }}>
                      {output.relayOn ? 'BẬT' : 'TẮT'}
                    </Tag>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card style={{ borderRadius: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>📺</div>
                  <div>
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>LCD Display</Text>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                      {output.lcdMessage || 'Không có tin nhắn'}
                    </Text>
                    <Button type="primary" onClick={() => sendLcd(`${zone} - OK`)}>
                      Gửi trạng thái
                    </Button>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* History Chart Placeholder */}
          {history.length > 0 && (
            <Card title={`Lịch sử (${history.length} điểm dữ liệu)`} style={{ borderRadius: 12, marginTop: 24 }}>
              <Text type="secondary">
                Dữ liệu gần nhất: Nhiệt độ {history[history.length - 1]?.temperature}°C, 
                Độ ẩm {history[history.length - 1]?.humidity}%, 
                Ánh sáng {history[history.length - 1]?.light} lux
              </Text>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
