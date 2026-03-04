"use client";

/**
 * app/(operator)/operator/alerts/page.tsx
 * Xử lý Cảnh báo
 */
import { Typography, Card, Table, Tag, Button, Space, Badge } from 'antd';
import { AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useOperatorContext } from '@/contexts/OperatorContext';

const { Title, Text } = Typography;

const mockAlerts = [
  { id: 'A001', machine: 'M-B2', type: 'error', message: 'Quá nhiệt - Vượt ngưỡng 85°C', time: '10:30', status: 'pending' },
  { id: 'A002', machine: 'M-A1', type: 'warning', message: 'Độ ẩm thấp bất thường', time: '09:45', status: 'acknowledged' },
  { id: 'A003', machine: 'M-A3', type: 'info', message: 'Mẻ sấy hoàn thành', time: '08:20', status: 'resolved' },
];

export default function AlertHandlingPage() {
  const { zone } = useOperatorContext();

  const columns = [
    {
      title: 'Mức độ',
      dataIndex: 'type',
      render: (v: string) => (
        <Badge
          status={v === 'error' ? 'error' : v === 'warning' ? 'warning' : 'processing'}
          text={v === 'error' ? 'Nghiêm trọng' : v === 'warning' ? 'Cảnh báo' : 'Thông tin'}
        />
      ),
    },
    { title: 'Máy', dataIndex: 'machine' },
    { title: 'Nội dung', dataIndex: 'message', render: (v: string) => <Text>{v}</Text> },
    { title: 'Thời gian', dataIndex: 'time' },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={v === 'pending' ? 'error' : v === 'acknowledged' ? 'warning' : 'success'}>
          {v === 'pending' ? 'Chờ xử lý' : v === 'acknowledged' ? 'Đã nhận' : 'Đã xử lý'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: unknown, record: typeof mockAlerts[0]) => (
        <Space>
          {record.status === 'pending' && (
            <Button size="small" type="primary">Xác nhận</Button>
          )}
          {record.status === 'acknowledged' && (
            <Button size="small" icon={<CheckCircleOutlined />}>Hoàn tất</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <AlertOutlined style={{ marginRight: 10, color: '#ff4d4f' }} />
          Xử lý Cảnh báo — {zone}
        </Title>
        <Text type="secondary">Danh sách các cảnh báo và sự cố cần xử lý</Text>
      </div>

      {/* Summary */}
      <Space style={{ marginBottom: 24 }}>
        <Tag color="error" style={{ padding: '4px 12px', fontSize: 14 }}>
          🔴 Chờ xử lý: {mockAlerts.filter(a => a.status === 'pending').length}
        </Tag>
        <Tag color="warning" style={{ padding: '4px 12px', fontSize: 14 }}>
          🟡 Đang xử lý: {mockAlerts.filter(a => a.status === 'acknowledged').length}
        </Tag>
        <Tag color="success" style={{ padding: '4px 12px', fontSize: 14 }}>
          🟢 Đã xử lý: {mockAlerts.filter(a => a.status === 'resolved').length}
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={mockAlerts}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}
