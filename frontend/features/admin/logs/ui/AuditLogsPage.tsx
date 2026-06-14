"use client";

/**
 * app/(admin)/admin/logs/page.tsx
 * Nhật ký Hệ thống
 */
import { useEffect, useMemo, useState } from 'react';
import { Typography, Card, Table, Tag, Input, DatePicker, Select, Space, Button, Spin, App } from 'antd';
import { FileTextOutlined, SearchOutlined, ExportOutlined, FilterOutlined } from '@ant-design/icons';
import { alertsApi, ApiAlert } from '@/shared/lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type AuditRow = {
  id: string;
  alertID: number;
  alertStatus: string;
  timestamp: string;
  rawTimestamp?: string;
  level: 'error' | 'warning' | 'info' | 'default';
  user: string;
  userRole?: string;
  action: string;
  details: string;
  ip: string;
};

export default function AuditLogsPage() {
  const { message } = App.useApp();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

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
      .map((row) => {
        const latestResolution = row.alertResolutions?.[0];
        const resolverUser = latestResolution?.user;
        
        let userName = 'Hệ thống';
        let userRole = 'system';
        
        if (resolverUser) {
          userName = `${resolverUser.firstName ?? ''} ${resolverUser.lastName ?? ''}`.trim() || resolverUser.email || 'Người dùng';
          userRole = resolverUser.role || 'operator';
        }

        const actionLabels: Record<string, string> = {
          error: 'LỖI HỆ THỐNG',
          warning: 'CẢNH BÁO',
          info: 'THÔNG TIN',
        };
        const action = actionLabels[row.alertType || ''] || (row.alertType || 'sự kiện').toUpperCase();

        return {
          id: `alert-${row.alertID}`,
          alertID: row.alertID,
          alertStatus: row.alertStatus || 'pending',
          timestamp: row.alertTime ? new Date(row.alertTime).toLocaleString('vi') : '—',
          rawTimestamp: row.alertTime || undefined,
          level: levelMap(row.alertType),
          user: userName,
          userRole: userRole,
          action: action,
          details: row.alertMessage || 'Không có mô tả',
          ip: 'internal',
        };
      });
  };

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const rows = await alertsApi.getAll();
      setLogs(toRows(rows));
    } catch {
      message.error('Không thể tải nhật ký hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAlerts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAcknowledge = async (alertID: number) => {
    try {
      await alertsApi.acknowledge(alertID);
      message.success('Admin đã xác nhận cảnh báo.');
      await loadAlerts();
    } catch {
      message.error('Không thể xác nhận cảnh báo.');
    }
  };

  const handleResolve = async (alertID: number) => {
    try {
      await alertsApi.resolve(alertID, {
        resolveStatus: 'resolved',
        resolveNote: 'Admin đã xác nhận xử lý xong',
      });
      message.success('Admin đã hoàn tất cảnh báo.');
      await loadAlerts();
    } catch {
      message.error('Không thể hoàn tất cảnh báo.');
    }
  };

  // Filtered logs selector
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Level Filter
      if (levelFilter !== 'all' && log.level !== levelFilter) {
        return false;
      }

      // 2. User/Role Filter
      if (userFilter !== 'all') {
        const uRole = String(log.userRole || '').toLowerCase();
        if (userFilter === 'system' && uRole !== 'system') return false;
        if (userFilter === 'admin' && uRole !== 'admin') return false;
        if (userFilter === 'manager' && uRole !== 'manager') return false;
        if (userFilter === 'operator' && uRole !== 'operator') return false;
      }

      // 3. Search Text
      if (searchText.trim()) {
        const query = searchText.toLowerCase().trim();
        const matchesDetail = log.details.toLowerCase().includes(query);
        const matchesAction = log.action.toLowerCase().includes(query);
        const matchesUser = log.user.toLowerCase().includes(query);
        const matchesIp = log.ip.toLowerCase().includes(query);
        if (!matchesDetail && !matchesAction && !matchesUser && !matchesIp) {
          return false;
        }
      }

      // 4. Date Range Filter
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dateRange[0].startOf('day').valueOf();
        const end = dateRange[1].endOf('day').valueOf();
        if (log.rawTimestamp) {
          const logTime = new Date(log.rawTimestamp).getTime();
          if (logTime < start || logTime > end) {
            return false;
          }
        } else {
          return false;
        }
      }

      return true;
    });
  }, [logs, levelFilter, userFilter, searchText, dateRange]);

  const counts = useMemo(() => ({
    error: filteredLogs.filter((l) => l.level === 'error').length,
    warning: filteredLogs.filter((l) => l.level === 'warning').length,
    info: filteredLogs.filter((l) => l.level === 'info').length,
  }), [filteredLogs]);

  const columns = [
    { title: 'Thời gian', dataIndex: 'timestamp', width: 180 },
    {
      title: 'Mức độ',
      dataIndex: 'level',
      width: 120,
      render: (v: string) => {
        const labels: Record<string, string> = {
          error: 'LỖI',
          warning: 'CẢNH BÁO',
          info: 'THÔNG TIN',
          default: 'MẶC ĐỊNH',
        };
        return (
          <Tag color={v === 'error' ? 'error' : v === 'warning' ? 'warning' : v === 'info' ? 'blue' : 'default'}>
            {labels[v] || v.toUpperCase()}
          </Tag>
        );
      },
    },
    { title: 'Tác nhân', dataIndex: 'user', width: 160 },
    { title: 'Hành động', dataIndex: 'action', width: 150, render: (v: string) => <Text strong>{v}</Text> },
    {
      title: 'Trạng thái xử lý',
      dataIndex: 'alertStatus',
      width: 140,
      render: (v: string) => (
        <Tag color={v === 'pending' ? 'error' : v === 'acknowledged' ? 'warning' : 'success'}>
          {v === 'pending' ? 'Chờ xử lý' : v === 'acknowledged' ? 'Đã nhận' : 'Đã xử lý'}
        </Tag>
      ),
    },
    { title: 'Chi tiết lỗi / sự kiện', dataIndex: 'details', ellipsis: true },
    { title: 'IP', dataIndex: 'ip', width: 100 },
    {
      title: 'Xác nhận',
      key: 'confirm',
      width: 130,
      render: (_: unknown, row: AuditRow) => (
        <Space>
          {row.alertStatus === 'pending' && (
            <Button size="small" type="primary" onClick={() => void handleAcknowledge(row.alertID)}>
              Nhận cảnh báo
            </Button>
          )}
          {row.alertStatus === 'acknowledged' && (
            <Button size="small" onClick={() => void handleResolve(row.alertID)}>
              Hoàn tất
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (loading && logs.length === 0) {
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
        <Space wrap size={12}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <RangePicker
            style={{ borderRadius: 7 }}
            value={dateRange}
            onChange={(dates) => setDateRange(dates ? [dates[0], dates[1]] : null)}
          />
          <Select
            value={levelFilter}
            onChange={setLevelFilter}
            style={{ width: 150 }}
          >
            <Select.Option value="all">Tất cả mức độ</Select.Option>
            <Select.Option value="error">Lỗi (Error)</Select.Option>
            <Select.Option value="warning">Cảnh báo (Warning)</Select.Option>
            <Select.Option value="info">Thông tin (Info)</Select.Option>
          </Select>
          <Select
            value={userFilter}
            onChange={setUserFilter}
            style={{ width: 190 }}
          >
            <Select.Option value="all">Tất cả tác nhân</Select.Option>
            <Select.Option value="system">Hệ thống (System)</Select.Option>
            <Select.Option value="admin">Quản trị viên (Admin)</Select.Option>
            <Select.Option value="manager">Quản lý (Manager)</Select.Option>
            <Select.Option value="operator">Vận hành viên (Operator)</Select.Option>
          </Select>
          <Button icon={<FilterOutlined />} onClick={() => void loadAlerts()}>Lọc</Button>
          <Button
            type="text"
            onClick={() => {
              setSearchText('');
              setLevelFilter('all');
              setUserFilter('all');
              setDateRange(null);
            }}
          >
            Đặt lại
          </Button>
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
          Tổng: {filteredLogs.length} / {logs.length} bản ghi
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={filteredLogs}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 15 }}
          loading={loading}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '12px 24px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>Thời gian ghi nhận:</strong> <Text type="secondary">{record.timestamp}</Text>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>Mức độ:</strong> <Tag color={record.level === 'error' ? 'error' : record.level === 'warning' ? 'warning' : record.level === 'info' ? 'blue' : 'default'}>
                    {record.level === 'error' ? 'LỖI' : record.level === 'warning' ? 'CẢNH BÁO' : record.level === 'info' ? 'THÔNG TIN' : 'MẶC ĐỊNH'}
                  </Tag>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <strong>Tác nhân thực hiện:</strong> <Text strong>{record.user}</Text> {record.userRole !== 'system' && <Tag color="cyan">{record.userRole?.toUpperCase()}</Tag>}
                </div>
                <div>
                  <strong>Chi tiết nội dung:</strong>
                  <pre style={{ marginTop: 6, padding: 12, background: '#fff', borderRadius: 4, border: '1px solid #e8e8e8', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 13, color: '#333' }}>
                    {record.details}
                  </pre>
                </div>
              </div>
            ),
            rowExpandable: (record) => record.details !== 'Không có mô tả',
          }}
        />
      </Card>
    </div>
  );
}
