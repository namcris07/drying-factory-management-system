"use client";

/**
 * app/(manager)/batches/page.tsx
 * Lịch sử Mẻ sấy — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Space, Button, Select, Spin, App } from 'antd';
import { HistoryOutlined, ExportOutlined } from '@ant-design/icons';
import { batchesApi, ApiBatch } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function BatchesPage() {
  const { message } = App.useApp();
  const [batches, setBatches] = useState<ApiBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    batchesApi.getAll()
      .then(setBatches)
      .catch(() => message.error('Không thể tải danh sách mẻ sấy.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = statusFilter === 'all'
    ? batches
    : batches.filter(b => b.batchStatus === statusFilter);

  const columns = [
    { title: 'Mã mẻ', dataIndex: 'batchesID', width: 80 },
    {
      title: 'Thiết bị',
      key: 'device',
      render: (_: unknown, r: ApiBatch) => r.device?.deviceName ?? '—',
    },
    {
      title: 'Công thức',
      key: 'recipe',
      render: (_: unknown, r: ApiBatch) => <Text strong>{r.recipe?.recipeName ?? '—'}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'batchStatus',
      render: (v: string) => (
        <Tag color={v === 'Completed' ? 'success' : v === 'Running' ? 'processing' : v === 'Error' ? 'error' : 'default'}>
          {v === 'Completed' ? 'Hoàn thành' : v === 'Running' ? 'Đang chạy' : v === 'Error' ? 'Lỗi' : v}
        </Tag>
      ),
    },
    {
      title: 'Bắt đầu',
      key: 'startedAt',
      render: (_: unknown, r: ApiBatch) => {
        const op = r.batchOperations?.[0];
        if (!op?.startedAt) return <Text type="secondary">—</Text>;
        return new Date(op.startedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      },
    },
    {
      title: 'Chất lượng',
      dataIndex: 'batchResult',
      render: (v: string) => v ? <Tag color="green">{v}</Tag> : <Text type="secondary">—</Text>,
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

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
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'Running', label: 'Đang chạy' },
              { value: 'Completed', label: 'Hoàn thành' },
              { value: 'Error', label: 'Lỗi' },
            ]}
          />
          <Button type="primary" icon={<ExportOutlined />}>Xuất Excel</Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="batchesID"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
