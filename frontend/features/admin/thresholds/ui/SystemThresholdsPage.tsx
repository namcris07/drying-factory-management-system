"use client";

/**
 * app/(admin)/admin/thresholds/page.tsx
 * Thiết lập Ngưỡng Hệ thống
 */
import { Typography, Card, Form, InputNumber, Button, Row, Col, Alert, Space, Switch } from 'antd';
import { SettingOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { initialThresholds, SystemThresholds } from '@/features/admin/model/admin-data';

const { Title, Text } = Typography;

export default function SystemThresholdsPage() {
  const [thresholds, setThresholds] = useState<SystemThresholds>(initialThresholds);

  const handleSave = () => {
    // Save logic here
    console.log('Saving thresholds:', thresholds);
  };

  const handleReset = () => {
    setThresholds(initialThresholds);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <SettingOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Thiết lập Ngưỡng Hệ thống
          </Title>
          <Text type="secondary">Cấu hình các ngưỡng cảnh báo và giới hạn vận hành</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>Khôi phục mặc định</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            Lưu thay đổi
          </Button>
        </Space>
      </div>

      <Alert
        message="Lưu ý quan trọng"
        description="Thay đổi các ngưỡng này sẽ ảnh hưởng đến toàn bộ hệ thống cảnh báo. Vui lòng kiểm tra kỹ trước khi lưu."
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Card title="🌡️ Ngưỡng Nhiệt độ & Độ ẩm" style={{ borderRadius: 12, marginBottom: 24 }}>
            <Form layout="vertical">
              <Form.Item label="Nhiệt độ an toàn tối đa (°C)">
                <InputNumber
                  value={thresholds.maxTempSafe}
                  onChange={(v) => setThresholds({ ...thresholds, maxTempSafe: v || 0 })}
                  style={{ width: '100%' }}
                  min={0}
                  max={150}
                />
              </Form.Item>
              <Form.Item label="Độ ẩm tối thiểu (%)">
                <InputNumber
                  value={thresholds.minHumidity}
                  onChange={(v) => setThresholds({ ...thresholds, minHumidity: v || 0 })}
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                />
              </Form.Item>
              <Form.Item label="Độ ẩm tối đa (%)">
                <InputNumber
                  value={thresholds.maxHumidity}
                  onChange={(v) => setThresholds({ ...thresholds, maxHumidity: v || 0 })}
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                />
              </Form.Item>
              <Form.Item label="Ngưỡng cảm biến ánh sáng">
                <InputNumber
                  value={thresholds.lightSensorThreshold}
                  onChange={(v) => setThresholds({ ...thresholds, lightSensorThreshold: v || 0 })}
                  style={{ width: '100%' }}
                  min={0}
                  max={1024}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="⚙️ Cấu hình MQTT" style={{ borderRadius: 12, marginBottom: 24 }}>
            <Form layout="vertical">
              <Form.Item label="MQTT Broker Host">
                <Text code>{thresholds.mqttBrokerHost}</Text>
              </Form.Item>
              <Form.Item label="MQTT Broker Port">
                <InputNumber
                  value={thresholds.mqttBrokerPort}
                  onChange={(v) => setThresholds({ ...thresholds, mqttBrokerPort: v || 1883 })}
                  style={{ width: '100%' }}
                  min={1}
                  max={65535}
                />
              </Form.Item>
              <Form.Item label="MQTT Keep Alive (giây)">
                <InputNumber
                  value={thresholds.mqttKeepAlive}
                  onChange={(v) => setThresholds({ ...thresholds, mqttKeepAlive: v || 60 })}
                  style={{ width: '100%' }}
                  min={10}
                  max={300}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Card title="⏱️ Ngưỡng Thời gian" style={{ borderRadius: 12, marginBottom: 24 }}>
            <Form layout="vertical">
              <Form.Item label="Độ trễ cảnh báo (giây)">
                <InputNumber
                  value={thresholds.alertDelaySeconds}
                  onChange={(v) => setThresholds({ ...thresholds, alertDelaySeconds: v || 0 })}
                  style={{ width: '100%' }}
                  min={0}
                  max={300}
                />
              </Form.Item>
              <Form.Item label="Thời gian chờ mở cửa (phút)">
                <InputNumber
                  value={thresholds.doorOpenTimeout}
                  onChange={(v) => setThresholds({ ...thresholds, doorOpenTimeout: v || 0 })}
                  style={{ width: '100%' }}
                  min={1}
                  max={60}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="📊 Lưu trữ dữ liệu" style={{ borderRadius: 12, marginBottom: 24 }}>
            <Form layout="vertical">
              <Form.Item label="Thời gian lưu trữ dữ liệu (ngày)">
                <InputNumber
                  value={thresholds.dataRetentionDays}
                  onChange={(v) => setThresholds({ ...thresholds, dataRetentionDays: v || 365 })}
                  style={{ width: '100%' }}
                  min={30}
                  max={3650}
                />
              </Form.Item>
              <Form.Item label="Tự động lưu trữ batch sau (ngày)">
                <InputNumber
                  value={thresholds.batchAutoArchiveDays}
                  onChange={(v) => setThresholds({ ...thresholds, batchAutoArchiveDays: v || 90 })}
                  style={{ width: '100%' }}
                  min={7}
                  max={365}
                />
              </Form.Item>
              <Form.Item label="Tự động dừng khi vượt ngưỡng">
                <Switch
                  checked={thresholds.autoStopEnabled}
                  onChange={(v) => setThresholds({ ...thresholds, autoStopEnabled: v })}
                  checkedChildren="Bật"
                  unCheckedChildren="Tắt"
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
