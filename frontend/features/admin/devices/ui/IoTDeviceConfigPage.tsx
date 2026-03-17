"use client";

/**
 * app/(admin)/admin/devices/page.tsx
 * Cấu hình Thiết bị IoT — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Button, Space, Badge, Spin, App } from 'antd';
import { ApiOutlined, PlusOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons';
import { devicesApi, ApiDevice } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function IoTDeviceConfigPage() {
  const { message } = App.useApp();
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    devicesApi.getAll()
      .then(setDevices)
      .catch(() => message.error('Không thể tải danh sách thiết bị.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { title: 'ID', dataIndex: 'deviceID', width: 80 },
    { title: 'Tên', dataIndex: 'deviceName', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Loại', dataIndex: 'deviceType', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Zone',
      key: 'zone',
      render: (_: unknown, r: ApiDevice) => r.zone?.zoneName ?? '—',
    },
    {
      title: 'Kết nối',
      dataIndex: 'deviceStatus',
      render: (v: string) => (
        <Badge
          status={v === 'Active' ? 'success' : 'error'}
          text={v === 'Active' ? 'Online' : 'Offline'}
        />
      ),
    },
    {
      title: 'MQTT Sensor Topic',
      dataIndex: 'mqttTopicSensor',
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: () => (
        <Space>
          <Button size="small" icon={<EditOutlined />} />
          <Button size="small" icon={<SyncOutlined />} />
        </Space>
      ),
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ApiOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Cấu hình Thiết bị IoT
          </Title>
          <Text type="secondary">Quản lý sensors, actuators và các thiết bị kết nối</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}>
          Thêm thiết bị
        </Button>
      </div>

      {/* Stats */}
      <Space style={{ marginBottom: 24 }}>
        <Tag color="success" style={{ padding: '8px 16px', fontSize: 14 }}>
          🟢 Online: {devices.filter(d => d.deviceStatus === 'Active').length}
        </Tag>
        <Tag color="error" style={{ padding: '8px 16px', fontSize: 14 }}>
          🔴 Offline: {devices.filter(d => d.deviceStatus !== 'Active').length}
        </Tag>
        <Tag style={{ padding: '8px 16px', fontSize: 14 }}>
          📡 Tổng: {devices.length}
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={devices}
          columns={columns}
          rowKey="deviceID"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
