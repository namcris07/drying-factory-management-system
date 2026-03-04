"use client";

/**
 * app/(operator)/operator/realtime/page.tsx
 * Giám sát Thời gian thực
 */
import { Typography, Card, Row, Col, Tag, Space, Progress, Table } from 'antd';
import { DesktopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useOperatorContext } from '@/contexts/OperatorContext';

const { Title, Text } = Typography;

export default function RealTimeMonitoringPage() {
  const { machines, zone } = useOperatorContext();
  const zoneMachines = machines.filter(m => m.zone === zone);

  const columns = [
    { title: 'Máy', dataIndex: 'name', width: 120 },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={v === 'Running' ? 'success' : v === 'Idle' ? 'default' : v === 'Error' ? 'error' : 'warning'}>
          {v === 'Running' ? 'Đang chạy' : v === 'Idle' ? 'Chờ' : v === 'Error' ? 'Lỗi' : 'Bảo trì'}
        </Tag>
      ),
    },
    { title: 'Nhiệt độ', dataIndex: 'temp', render: (v: number) => v ? `${v}°C` : '—' },
    { title: 'Độ ẩm', dataIndex: 'humidity', render: (v: number) => v ? `${v}%` : '—' },
    { title: 'Công thức', dataIndex: 'recipe', render: (v: string) => v || '—' },
    {
      title: 'Tiến độ',
      dataIndex: 'progress',
      render: (v: number) => v ? <Progress percent={Math.round(v)} size="small" /> : '—',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <DesktopOutlined style={{ marginRight: 10, color: '#52c41a' }} />
          Giám sát Thời gian thực — {zone}
        </Title>
        <Text type="secondary">Theo dõi trạng thái và thông số sensor của tất cả máy trong khu vực</Text>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #52c41a' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>
              {zoneMachines.filter(m => m.status === 'Running').length}
            </div>
            <Text type="secondary">Đang chạy</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #8c8c8c' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#8c8c8c' }}>
              {zoneMachines.filter(m => m.status === 'Idle').length}
            </div>
            <Text type="secondary">Chờ</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #ff4d4f' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f' }}>
              {zoneMachines.filter(m => m.status === 'Error').length}
            </div>
            <Text type="secondary">Lỗi</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #faad14' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#faad14' }}>
              {zoneMachines.filter(m => m.status === 'Maintenance').length}
            </div>
            <Text type="secondary">Bảo trì</Text>
          </Card>
        </Col>
      </Row>

      {/* Machine Table */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={zoneMachines}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}
