"use client";

/**
 * app/(admin)/admin/logs/page.tsx
 * Nhật ký Hệ thống
 */
import { Typography, Card, Table, Tag, Input, DatePicker, Select, Space, Button } from 'antd';
import { FileTextOutlined, SearchOutlined, ExportOutlined, FilterOutlined } from '@ant-design/icons';
import { initialAuditLogs } from '@/data/adminData';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function AuditLogsPage() {
  const columns = [
    { title: 'Thời gian', dataIndex: 'timestamp', width: 180 },
    {
      title: 'Mức độ',
      dataIndex: 'level',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'error' ? 'error' : v === 'warning' ? 'warning' : v === 'info' ? 'blue' : 'default'}>
          {v.toUpperCase()}
        </Tag>
      ),
    },
    { title: 'Người dùng', dataIndex: 'user' },
    { title: 'Hành động', dataIndex: 'action', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Chi tiết', dataIndex: 'details', ellipsis: true },
    { title: 'IP', dataIndex: 'ip', width: 130 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <FileTextOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Nhật ký Hệ thống
          </Title>
          <Text type="secondary">Theo dõi tất cả hoạt động và sự kiện trong hệ thống</Text>
        </div>
        <Button type="primary" icon={<ExportOutlined />}>
          Xuất log
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ borderRadius: 12, marginBottom: 24 }}>
        <Space wrap>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm..."
            style={{ width: 200 }}
          />
          <RangePicker style={{ borderRadius: 7 }} />
          <Select defaultValue="all" style={{ width: 140 }}>
            <Select.Option value="all">Tất cả mức độ</Select.Option>
            <Select.Option value="error">Error</Select.Option>
            <Select.Option value="warning">Warning</Select.Option>
            <Select.Option value="info">Info</Select.Option>
          </Select>
          <Select defaultValue="all" style={{ width: 140 }}>
            <Select.Option value="all">Tất cả người dùng</Select.Option>
            <Select.Option value="admin">Admin</Select.Option>
            <Select.Option value="manager">Manager</Select.Option>
            <Select.Option value="operator">Operator</Select.Option>
          </Select>
          <Button icon={<FilterOutlined />}>Lọc</Button>
        </Space>
      </Card>

      {/* Stats */}
      <Space style={{ marginBottom: 24 }}>
        <Tag color="error" style={{ padding: '4px 12px' }}>
          Error: {initialAuditLogs.filter(l => l.level === 'error').length}
        </Tag>
        <Tag color="warning" style={{ padding: '4px 12px' }}>
          Warning: {initialAuditLogs.filter(l => l.level === 'warning').length}
        </Tag>
        <Tag color="blue" style={{ padding: '4px 12px' }}>
          Info: {initialAuditLogs.filter(l => l.level === 'info').length}
        </Tag>
        <Tag style={{ padding: '4px 12px' }}>
          Tổng: {initialAuditLogs.length} bản ghi
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={initialAuditLogs}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  );
}
