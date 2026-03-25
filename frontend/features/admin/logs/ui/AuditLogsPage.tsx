"use client";

/**
 * app/(admin)/admin/logs/page.tsx
 * Nhật ký Hệ thống
 */
import { useEffect, useMemo, useState } from 'react';
import { Typography, Card, Table, Tag, Input, DatePicker, Select, Space, Button, Spin, App } from 'antd';
import { FileTextOutlined, SearchOutlined, ExportOutlined, FilterOutlined } from '@ant-design/icons';
import { alertsApi, ApiAlert } from '@/shared/lib/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type AuditRow = {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info' | 'default';
  user: string;
  action: string;
  details: string;
  ip: string;
};

export default function AuditLogsPage() {
  const { message } = App.useApp();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const levelMap = (type: string | null): AuditRow['level'] => {
      if (type === 'error') return 'error';
      if (type === 'warning') return 'warning';
      if (type === 'info') return 'info';
      return 'default';
    };

    const toRows = (rows: ApiAlert[]): AuditRow[] => {
      return rows
        .slice()
        .sort((a, b) => {
          const ta = a.alertTime ? new Date(a.alertTime).getTime() : 0;
          const tb = b.alertTime ? new Date(b.alertTime).getTime() : 0;
          return tb - ta;
        })
        .map((row) => ({
          id: `alert-${row.alertID}`,
          timestamp: row.alertTime ? new Date(row.alertTime).toLocaleString('vi') : '—',
          level: levelMap(row.alertType),
          user: 'System',
          action: (row.alertType || 'event').toUpperCase(),
          details: row.alertMessage || 'Không có mô tả',
          ip: 'internal',
        }));
    };

    alertsApi.getAll()
      .then((rows) => setLogs(toRows(rows)))
      .catch(() => message.error('Không thể tải nhật ký hệ thống.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    error: logs.filter((l) => l.level === 'error').length,
    warning: logs.filter((l) => l.level === 'warning').length,
    info: logs.filter((l) => l.level === 'info').length,
  }), [logs]);

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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

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
          Error: {counts.error}
        </Tag>
        <Tag color="warning" style={{ padding: '4px 12px' }}>
          Warning: {counts.warning}
        </Tag>
        <Tag color="blue" style={{ padding: '4px 12px' }}>
          Info: {counts.info}
        </Tag>
        <Tag style={{ padding: '4px 12px' }}>
          Tổng: {logs.length} bản ghi
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 15 }}
        />
      </Card>
    </div>
  );
}
