"use client";

/**
 * app/(operator)/operator/alerts/page.tsx
 * Xử lý Cảnh báo — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Button, Space, Badge, Spin, App } from 'antd';
import { AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useOperatorContext } from '@/features/operator/model/operator-context';
import { alertsApi, ApiAlert } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function AlertHandlingPage() {
  const { zone } = useOperatorContext();
  const { message } = App.useApp();
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAlerts = async () => {
    try {
      const data = await alertsApi.getAll();
      setAlerts(data);
    } catch {
      message.error('Không thể tải danh sách cảnh báo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAlerts(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAcknowledge = async (alert: ApiAlert) => {
    try {
      await alertsApi.acknowledge(alert.alertID);
      message.success('Đã xác nhận cảnh báo.');
      await loadAlerts();
    } catch {
      message.error('Thao tác thất bại.');
    }
  };

  const handleResolve = async (alert: ApiAlert) => {
    try {
      await alertsApi.resolve(alert.alertID, { resolveStatus: 'resolved', resolveNote: 'Đã xử lý xong' });
      message.success('Cảnh báo đã được đánh dấu hoàn tất.');
      await loadAlerts();
    } catch {
      message.error('Thao tác thất bại.');
    }
  };

  const columns = [
    {
      title: 'Mức độ',
      dataIndex: 'alertType',
      render: (v: string) => (
        <Badge
          status={v === 'error' ? 'error' : v === 'warning' ? 'warning' : 'processing'}
          text={v === 'error' ? 'Nghiêm trọng' : v === 'warning' ? 'Cảnh báo' : 'Thông tin'}
        />
      ),
    },
    {
      title: 'Thiết bị',
      key: 'device',
      render: (_: unknown, r: ApiAlert) => r.device?.deviceName ?? '—',
    },
    { title: 'Nội dung', dataIndex: 'alertMessage', render: (v: string) => <Text>{v}</Text> },
    {
      title: 'Thời gian',
      dataIndex: 'alertTime',
      render: (v: string) => v ? new Date(v).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'alertStatus',
      render: (v: string) => (
        <Tag color={v === 'pending' ? 'error' : v === 'acknowledged' ? 'warning' : 'success'}>
          {v === 'pending' ? 'Chờ xử lý' : v === 'acknowledged' ? 'Đã nhận' : 'Đã xử lý'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: unknown, record: ApiAlert) => (
        <Space>
          {record.alertStatus === 'pending' && (
            <Button size="small" type="primary" onClick={() => handleAcknowledge(record)}>Xác nhận</Button>
          )}
          {record.alertStatus === 'acknowledged' && (
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleResolve(record)}>Hoàn tất</Button>
          )}
        </Space>
      ),
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

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
          🔴 Chờ xử lý: {alerts.filter(a => a.alertStatus === 'pending').length}
        </Tag>
        <Tag color="warning" style={{ padding: '4px 12px', fontSize: 14 }}>
          🟡 Đang xử lý: {alerts.filter(a => a.alertStatus === 'acknowledged').length}
        </Tag>
        <Tag color="success" style={{ padding: '4px 12px', fontSize: 14 }}>
          🟢 Đã xử lý: {alerts.filter(a => a.alertStatus === 'resolved').length}
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={alerts}
          columns={columns}
          rowKey="alertID"
          pagination={false}
        />
      </Card>
    </div>
  );
}
