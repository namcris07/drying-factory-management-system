"use client";

/**
 * app/(manager)/batches/page.tsx
 * Lịch sử Mẻ sấy
 */
import { Typography, Card, Table, Tag, Space, Button, DatePicker, Select } from 'antd';
import { HistoryOutlined, ExportOutlined, FilterOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const mockBatches = [
  { id: 'B001', machine: 'M-A1', recipe: 'Xoài Standard', status: 'Completed', startTime: '08:00', endTime: '14:30', quality: 'A' },
  { id: 'B002', machine: 'M-A2', recipe: 'Chuối Chips', status: 'Completed', startTime: '09:15', endTime: '15:45', quality: 'A' },
  { id: 'B003', machine: 'M-B1', recipe: 'Thanh Long Premium', status: 'Running', startTime: '10:00', endTime: '—', quality: '—' },
  { id: 'B004', machine: 'M-B2', recipe: 'Xoài Standard', status: 'Error', startTime: '11:30', endTime: '—', quality: '—' },
];

export default function BatchesPage() {
  const columns = [
    { title: 'Mã mẻ', dataIndex: 'id', width: 80 },
    { title: 'Máy', dataIndex: 'machine' },
    { title: 'Công thức', dataIndex: 'recipe', render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={v === 'Completed' ? 'success' : v === 'Running' ? 'processing' : 'error'}>
          {v === 'Completed' ? 'Hoàn thành' : v === 'Running' ? 'Đang chạy' : 'Lỗi'}
        </Tag>
      ),
    },
    { title: 'Bắt đầu', dataIndex: 'startTime' },
    { title: 'Kết thúc', dataIndex: 'endTime' },
    {
      title: 'Chất lượng',
      dataIndex: 'quality',
      render: (v: string) => v !== '—' ? <Tag color="green">{v}</Tag> : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <HistoryOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            Lịch sử Mẻ sấy
          </Title>
          <Text type="secondary">Theo dõi và tra cứu lịch sử các mẻ sấy đã thực hiện</Text>
        </div>
        <Space>
          <RangePicker style={{ borderRadius: 7 }} />
          <Select defaultValue="all" style={{ width: 140 }}>
            <Select.Option value="all">Tất cả máy</Select.Option>
            <Select.Option value="zoneA">Zone A</Select.Option>
            <Select.Option value="zoneB">Zone B</Select.Option>
          </Select>
          <Button icon={<FilterOutlined />}>Lọc</Button>
          <Button type="primary" icon={<ExportOutlined />}>Xuất Excel</Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={mockBatches}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
