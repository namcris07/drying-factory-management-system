"use client";

/**
 * app/(admin)/admin/devices/page.tsx
 * Cấu hình Thiết bị IoT
 */
import { Typography, Card, Table, Tag, Button, Space, Badge } from 'antd';
import { ApiOutlined, PlusOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons';
import { initialDevices } from '@/data/adminData';

const { Title, Text } = Typography;

export default function IoTDeviceConfigPage() {
  const columns = [
    { title: 'Mã thiết bị', dataIndex: 'id', width: 120 },
    { title: 'Tên', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Loại', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Zone', dataIndex: 'zone' },
    {
      title: 'Kết nối',
      dataIndex: 'connected',
      render: (v: boolean) => (
        <Badge status={v ? 'success' : 'error'} text={v ? 'Online' : 'Offline'} />
      ),
    },
    { title: 'Cập nhật lần cuối', dataIndex: 'lastSeen' },
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
          🟢 Online: {initialDevices.filter(d => d.connected).length}
        </Tag>
        <Tag color="error" style={{ padding: '8px 16px', fontSize: 14 }}>
          🔴 Offline: {initialDevices.filter(d => !d.connected).length}
        </Tag>
        <Tag style={{ padding: '8px 16px', fontSize: 14 }}>
          📡 Tổng: {initialDevices.length}
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={initialDevices}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
