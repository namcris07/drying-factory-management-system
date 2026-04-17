"use client";

/**
 * app/(operator)/operator/realtime/page.tsx
 * Giám sát thời gian thực theo buồng
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Typography, Card, Row, Col, Tag, Progress, Table, Space, Input, Select, Button } from 'antd';
import { DesktopOutlined } from '@ant-design/icons';
import { useOperatorContext } from '@/features/operator/model/operator-context';
import { filterMachinesByZone } from '@/features/operator/model/zone-utils';
import { mqttApi } from '@/shared/lib/api';

const { Title, Text } = Typography;
const REFRESH_INTERVAL_MS = 5000;

export default function RealTimeMonitoringPage() {
  const { machines, zone } = useOperatorContext();
  const zoneMachines = useMemo(
    () => filterMachinesByZone(machines, zone),
    [machines, zone],
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Running' | 'Idle' | 'Error' | 'Maintenance'>('all');
  const [liveMachines, setLiveMachines] = useState(zoneMachines);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    setLiveMachines(zoneMachines);
  }, [zoneMachines]);

  useEffect(() => {
    let cancelled = false;

    const parseNumber = (value: unknown) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num * 10) / 10 : undefined;
    };

    const syncRealtimeState = async () => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      setIsRefreshing(true);

      try {
        const activeMachines = zoneMachines.filter((machine) => Number.isFinite(machine.deviceID));
        if (activeMachines.length === 0) {
          if (!cancelled) {
            setLastRefreshAt(new Date());
          }
          return;
        }

        const stateRows = await Promise.all(
          activeMachines.map(async (machine) => {
            try {
              const deviceState = await mqttApi.getDeviceState(machine.deviceID as number);
              return [machine.deviceID as number, deviceState] as const;
            } catch {
              return [machine.deviceID as number, null] as const;
            }
          }),
        );

        if (cancelled) return;

        const stateByDevice = new Map(stateRows);

        setLiveMachines(
          zoneMachines.map((machine) => {
            if (!machine.deviceID) return machine;

            const deviceState = stateByDevice.get(machine.deviceID);
            if (!deviceState) return machine;

            const feeds = deviceState.feeds ?? [];
            const tempFeed = feeds.find((feed) => feed.sensorType === 'temperature');
            const humidityFeed = feeds.find((feed) => feed.sensorType === 'humidity');

            const temp = parseNumber(tempFeed?.value);
            const humidity = parseNumber(humidityFeed?.value);

            return {
              ...machine,
              temp: temp ?? machine.temp,
              humidity: humidity ?? machine.humidity,
              sensorState: feeds.map((feed) => ({
                feed: feed.feed,
                sensorType: feed.sensorType,
                value: feed.value,
                updatedAt: feed.updatedAt,
              })),
              sensorFeeds:
                feeds.length > 0 ? feeds.map((feed) => feed.feed) : machine.sensorFeeds,
            };
          }),
        );
        setLastRefreshAt(new Date());
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
        refreshInFlightRef.current = false;
      }
    };

    void syncRealtimeState();
    const interval = setInterval(() => {
      void syncRealtimeState();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [zoneMachines]);

  const sensorLabel = (sensorType: string, feed: string) => {
    if (sensorType === 'temperature') return 'Nhiệt độ';
    if (sensorType === 'humidity') return 'Độ ẩm';
    if (sensorType === 'light') return 'Ánh sáng';
    return feed;
  };

  const sensorValue = (sensorType: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return '--';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    if (sensorType === 'temperature') return `${Math.round(num * 10) / 10}°C`;
    if (sensorType === 'humidity') return `${Math.round(num * 10) / 10}%`;
    if (sensorType === 'light') return `${Math.round(num * 10) / 10} lux`;
    return String(Math.round(num * 10) / 10);
  };

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
    {
      title: 'Luồng cảm biến',
      dataIndex: 'sensorState',
      render: (items: { feed: string; sensorType: string; value: unknown }[] | undefined) => {
        if (!items || items.length === 0) return '—';
        return (
          <Space wrap size={[6, 6]}>
            {items.map((item) => (
              <Tag key={item.feed}>
                {sensorLabel(item.sensorType, item.feed)}: {sensorValue(item.sensorType, item.value)}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    { title: 'Công thức', dataIndex: 'recipe', render: (v: string) => v || '—' },
    {
      title: 'Tiến độ',
      dataIndex: 'progress',
      render: (v: number) => v ? <Progress percent={Math.round(v)} size="small" /> : '—',
    },
  ];

  const filteredMachines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return liveMachines.filter((machine) => {
      if (statusFilter !== 'all' && machine.status !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const machineName = String(machine.name ?? '').toLowerCase();
      const recipeName = String(machine.recipe ?? '').toLowerCase();
      const machineId = String(machine.id ?? '').toLowerCase();
      return (
        machineName.includes(q) ||
        recipeName.includes(q) ||
        machineId.includes(q)
      );
    });
  }, [liveMachines, searchQuery, statusFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <DesktopOutlined style={{ marginRight: 10, color: '#52c41a' }} />
          Giám sát Buồng sấy — {zone}
        </Title>
        <Space size={12} wrap>
          <Text type="secondary">Theo dõi trạng thái và thông số cảm biến của thiết bị trong buồng được phân công</Text>
          <Tag color="processing">{isRefreshing ? 'Đang cập nhật realtime' : 'Realtime active'}</Tag>
          <Tag color="blue">
            Cập nhật gần nhất: {lastRefreshAt ? lastRefreshAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          </Tag>
        </Space>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #52c41a' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>
              {liveMachines.filter(m => m.status === 'Running').length}
            </div>
            <Text type="secondary">Đang chạy</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #8c8c8c' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#8c8c8c' }}>
              {liveMachines.filter(m => m.status === 'Idle').length}
            </div>
            <Text type="secondary">Chờ</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #ff4d4f' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#ff4d4f' }}>
              {liveMachines.filter(m => m.status === 'Error').length}
            </div>
            <Text type="secondary">Lỗi</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #faad14' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#faad14' }}>
              {liveMachines.filter(m => m.status === 'Maintenance').length}
            </div>
            <Text type="secondary">Bảo trì</Text>
          </Card>
        </Col>
      </Row>

      {/* Machine Table */}
      <Card style={{ borderRadius: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
          <Space wrap>
            <Input.Search
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm theo máy/mẻ..."
              allowClear
              style={{ width: 280 }}
            />
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'Running', label: 'Đang chạy' },
                { value: 'Idle', label: 'Chờ' },
                { value: 'Error', label: 'Lỗi' },
                { value: 'Maintenance', label: 'Bảo trì' },
              ]}
            />
            <Button onClick={clearFilters}>Xóa lọc</Button>
          </Space>
            <Text type="secondary">Hiển thị {filteredMachines.length}/{liveMachines.length} máy</Text>
        </Space>
        <Table
          dataSource={filteredMachines}
          columns={columns}
          rowKey="id"
          pagination={false}
            loading={isRefreshing && liveMachines.length === 0}
        />
      </Card>
    </div>
  );
}
