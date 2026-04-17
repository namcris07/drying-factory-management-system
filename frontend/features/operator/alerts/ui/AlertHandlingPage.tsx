"use client";

/**
 * app/(operator)/operator/alerts/page.tsx
 * Xử lý Cảnh báo — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Button, Space, Badge, Spin, App, Input, Select } from 'antd';
import { AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useOperatorContext } from '@/features/operator/model/operator-context';
import { alertsApi, ApiAlert } from '@/shared/lib/api';
import { getAuthSessionFromStorage } from '@/shared/auth/session';

const { Title, Text } = Typography;
const ALERT_REFRESH_INTERVAL_MS = 5000;

function getSensorFeedLabel(alert: ApiAlert): string {
  const message = alert.alertMessage?.trim() ?? '';
  const sensorMatch = message.match(/Cảm biến\s+(.+?)\s+(?:vượt ngưỡng|đã trở về|trở về|đạt lại)/i);
  if (sensorMatch?.[1]) {
    return sensorMatch[1].trim();
  }

  return alert.device?.deviceName?.trim() || '—';
}

function getThresholdScopeLabel(alert: ApiAlert): string {
  const message = alert.alertMessage?.toLowerCase() ?? '';
  if (message.includes('ngưỡng công thức')) {
    return 'Theo công thức';
  }
  if (message.includes('ngưỡng global')) {
    return 'Ngưỡng hệ thống';
  }
  return 'Ngưỡng khác';
}

export default function AlertHandlingPage() {
  const { zone } = useOperatorContext();
  const { message } = App.useApp();
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'acknowledged' | 'resolved' | 'auto_resolved'>('all');

  const getLatestResolution = (alert: ApiAlert) => alert.alertResolutions?.[0] ?? null;

  const getDisplayStatus = (alert: ApiAlert) => {
    if (alert.alertStatus !== 'resolved') {
      return alert.alertStatus;
    }

    const latest = getLatestResolution(alert);
    if (latest?.resolveStatus === 'auto_resolved') return 'auto_resolved';
    return 'resolved';
  };

  const getResolverName = (alert: ApiAlert): string => {
    const latest = getLatestResolution(alert);
    if (!latest) return '—';
    if (latest.resolveStatus === 'auto_resolved') return 'Hệ thống';

    const firstName = latest.user?.firstName?.trim() ?? '';
    const lastName = latest.user?.lastName?.trim() ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;
    if (latest.user?.email) return latest.user.email;
    if (latest.userID) return `User #${latest.userID}`;
    return 'Không xác định';
  };

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

  useEffect(() => {
    let cancelled = false;

    const refreshAlerts = async () => {
      try {
        const data = await alertsApi.getAll();
        if (cancelled) return;
        setAlerts(data);
      } catch {
        if (!cancelled) {
          message.error('Không thể tải danh sách cảnh báo.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void refreshAlerts();
    const interval = setInterval(() => {
      void refreshAlerts();
    }, ALERT_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      const session = getAuthSessionFromStorage();
      await alertsApi.resolve(alert.alertID, {
        resolveStatus: 'operator_resolved',
        resolveNote: 'Đã xử lý xong',
        userID: session?.userID,
      });
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
    {
      title: 'Cảm biến/Kênh',
      key: 'sensorFeed',
      render: (_: unknown, r: ApiAlert) => (
        <Space direction="vertical" size={0}>
          <Text>{getSensorFeedLabel(r)}</Text>
          <Tag color={getThresholdScopeLabel(r) === 'Theo công thức' ? 'gold' : 'blue'}>
            {getThresholdScopeLabel(r)}
          </Tag>
        </Space>
      ),
    },
    { title: 'Nội dung', dataIndex: 'alertMessage', render: (v: string) => <Text>{v}</Text> },
    {
      title: 'Thời gian',
      dataIndex: 'alertTime',
      render: (v: string) => v ? new Date(v).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—',
    },
    {
      title: 'Kết thúc lúc',
      key: 'resolvedAt',
      render: (_: unknown, r: ApiAlert) => {
        const resolvedAt = getLatestResolution(r)?.resolveTime;
        if (!resolvedAt) return '—';
        return new Date(resolvedAt).toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        });
      },
    },
    {
      title: 'Người/Kênh xử lý',
      key: 'resolvedBy',
      render: (_: unknown, r: ApiAlert) => getResolverName(r),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: unknown, r: ApiAlert) => {
        const status = getDisplayStatus(r);
        const color =
          status === 'pending'
            ? 'error'
            : status === 'acknowledged'
              ? 'warning'
              : status === 'auto_resolved'
                ? 'blue'
                : 'success';
        const label =
          status === 'pending'
            ? 'Chờ xử lý'
            : status === 'acknowledged'
              ? 'Đã nhận'
              : status === 'auto_resolved'
                ? 'Tự hồi phục'
                : 'Đã xử lý';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: 'Ghi chú xử lý',
      key: 'resolveNote',
      render: (_: unknown, r: ApiAlert) => getLatestResolution(r)?.resolveNote ?? '—',
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: unknown, record: ApiAlert) => (
        <Space>
          {record.alertStatus === 'pending' && (
            <Button size="small" type="primary" onClick={() => handleAcknowledge(record)}>Xác nhận đã nhận</Button>
          )}
          {record.alertStatus === 'acknowledged' && (
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleResolve(record)}>Đóng thủ công</Button>
          )}
        </Space>
      ),
    },
  ];

  const filteredAlerts = alerts.filter((alert) => {
    const displayStatus = getDisplayStatus(alert);

    if (levelFilter !== 'all' && alert.alertType !== levelFilter) {
      return false;
    }

    if (statusFilter !== 'all' && displayStatus !== statusFilter) {
      return false;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const messageText = String(alert.alertMessage ?? '').toLowerCase();
    const deviceText = String(alert.device?.deviceName ?? '').toLowerCase();
    const resolverText = getResolverName(alert).toLowerCase();
    const sensorText = getSensorFeedLabel(alert).toLowerCase();

    return (
      messageText.includes(q) ||
      deviceText.includes(q) ||
      resolverText.includes(q) ||
      sensorText.includes(q)
    );
  });

  const clearFilters = () => {
    setSearchQuery('');
    setLevelFilter('all');
    setStatusFilter('all');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <AlertOutlined style={{ marginRight: 10, color: '#ff4d4f' }} />
          Xử lý Cảnh báo Buồng sấy — {zone}
        </Title>
        <Text type="secondary">Danh sách cảnh báo và sự cố của buồng sấy đang phụ trách</Text>
      </div>

      {/* Summary */}
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <Space wrap>
          <Input.Search
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm nội dung/thiết bị/người xử lý..."
            allowClear
            style={{ width: 320 }}
          />
          <Select
            value={levelFilter}
            onChange={(value) => setLevelFilter(value)}
            style={{ width: 170 }}
            options={[
              { value: 'all', label: 'Tất cả mức độ' },
              { value: 'error', label: 'Nghiêm trọng' },
              { value: 'warning', label: 'Cảnh báo' },
              { value: 'info', label: 'Thông tin' },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: 190 }}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'pending', label: 'Chờ xử lý' },
              { value: 'acknowledged', label: 'Đã nhận' },
              { value: 'resolved', label: 'Đã xử lý thủ công' },
              { value: 'auto_resolved', label: 'Tự hồi phục' },
            ]}
          />
          <Button onClick={clearFilters}>Xóa lọc</Button>
        </Space>
        <Text type="secondary">Hiển thị {filteredAlerts.length}/{alerts.length} cảnh báo</Text>
      </Space>

      <Space style={{ marginBottom: 24 }}>
        <Tag color="error" style={{ padding: '4px 12px', fontSize: 14 }}>
          🔴 Chờ xử lý: {filteredAlerts.filter(a => a.alertStatus === 'pending').length}
        </Tag>
        <Tag color="warning" style={{ padding: '4px 12px', fontSize: 14 }}>
          🟡 Đang xử lý: {filteredAlerts.filter(a => a.alertStatus === 'acknowledged').length}
        </Tag>
        <Tag color="success" style={{ padding: '4px 12px', fontSize: 14 }}>
          🟢 Đã xử lý thủ công: {filteredAlerts.filter(a => getDisplayStatus(a) === 'resolved').length}
        </Tag>
        <Tag color="blue" style={{ padding: '4px 12px', fontSize: 14 }}>
          🔵 Tự hồi phục: {filteredAlerts.filter(a => getDisplayStatus(a) === 'auto_resolved').length}
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={filteredAlerts}
          columns={columns}
          rowKey="alertID"
          pagination={false}
        />
      </Card>
    </div>
  );
}
