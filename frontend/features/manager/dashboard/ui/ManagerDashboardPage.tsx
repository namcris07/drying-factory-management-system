"use client";

/**
 * app/(manager)/page.tsx
 * Dashboard KPI cho Manager
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Select,
  Button,
  Tag,
  Typography,
  Space,
  Progress,
  DatePicker,
  Divider,
  App,
  Spin,
  Alert,
} from 'antd';
import {
  ThunderboltOutlined,
  PauseCircleOutlined,
  WarningOutlined,
  RiseOutlined,
  ExportOutlined,
  MoreOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import {
  analyticsApi,
  ApiAnalyticsHourly,
  ApiAnalyticsSummary,
  ApiAnalyticsTrend,
  ApiBatch,
  ApiRecipe,
  batchesApi,
  recipesApi,
} from '@/shared/lib/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const mtbfData = [
  {
    name: 'Conveyor Motor A1',
    subtitle: 'Last maintenance: 45 days ago',
    risk: 'High Risk',
    riskColor: '#ff4d4f',
    progress: 88,
    progressColor: '#ff4d4f',
  },
  {
    name: 'Heating Element Z2',
    subtitle: 'Last maintenance: 2 days ago',
    risk: 'Optimal',
    riskColor: '#52c41a',
    progress: 15,
    progressColor: '#52c41a',
  },
  {
    name: 'Fan Blower B4',
    subtitle: 'Vibration detected',
    risk: 'Monitor',
    riskColor: '#faad14',
    progress: 55,
    progressColor: '#faad14',
  },
];

interface CustomDotProps {
  cx?: number;
  cy?: number;
}

type TrendPeriod = 'day' | 'week' | 'month' | 'year';

const LONG_RUNNING_THRESHOLD_HOURS = 8;

const getBatchStartedAt = (batch: ApiBatch): string | null => {
  const opStarted = batch.batchOperations.find((op) => op.startedAt)?.startedAt;
  return opStarted ?? batch.startedAt;
};

const isBatchRunningLong = (batch: ApiBatch, thresholdHours = LONG_RUNNING_THRESHOLD_HOURS) => {
  const status = (batch.batchStatus ?? '').toLowerCase();
  if (status !== 'running') return false;

  const startedAt = getBatchStartedAt(batch);
  if (!startedAt) return false;

  const durationHours = (Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60);
  return Number.isFinite(durationHours) && durationHours > thresholdHours;
};

const CustomDot = (props: CustomDotProps) => {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#ff4d4f" strokeWidth={2} />;
};

export default function DashboardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [zone, setZone] = useState('all');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('day');
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(89, 'day').startOf('day'),
    dayjs().endOf('day'),
  ]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ApiAnalyticsSummary | null>(null);
  const [trend, setTrend] = useState<ApiAnalyticsTrend | null>(null);
  const [hourly, setHourly] = useState<ApiAnalyticsHourly | null>(null);
  const [recipes, setRecipes] = useState<ApiRecipe[]>([]);
  const [longRunningCount, setLongRunningCount] = useState(0);

  const query = useMemo(() => {
    const [from, to] = range;
    return {
      from: from.startOf('day').toISOString(),
      to: to.endOf('day').toISOString(),
      zoneId: zone === 'zoneA' ? 1 : undefined,
    };
  }, [range, zone]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [s, t, h, r, runningRes] = await Promise.all([
          analyticsApi.getSummary(query),
          analyticsApi.getTrend({
            ...query,
            period: trendPeriod,
            page: 1,
            pageSize: 100,
          }),
          analyticsApi.getHourlyAvg({ ...query, metric: 'temperature' }),
          recipesApi.getAll({ includeInactive: true }),
          batchesApi.getAll({
            status: 'running',
            page: 1,
            pageSize: 100,
          }),
        ]);

        if (!mounted) return;
        setSummary(s);
        setTrend(t);
        setHourly(h);
        setRecipes(r);
        setLongRunningCount(runningRes.items.filter((batch) => isBatchRunningLong(batch)).length);
      } catch {
        if (!mounted) return;
        message.error('Không thể tải dữ liệu dashboard từ DB.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [query, message, trendPeriod]);

  const batchByZoneData = (trend?.points ?? []).map((point) => ({
    zone: trendPeriod === 'day' ? dayjs(point.date).format('DD/MM') : point.date,
    success: point.success,
    fail: point.fail,
  }));

  const completionData = [
    { name: 'Success', value: summary?.batches.success ?? 0, color: '#1677ff' },
    { name: 'Fail', value: summary?.batches.fail ?? 0, color: '#e6f4ff' },
  ];

  const heatLossData = (hourly?.points ?? []).map((p) => ({
    day: p.hour,
    events: p.avg,
  }));

  const successRate = summary?.batches.successRate ?? 0;
  const activeMachines = summary?.machines.active ?? 0;
  const totalMachines = summary?.machines.total ?? 0;
  const inactiveMachines = summary?.machines.inactive ?? 0;
  const failBatches = summary?.batches.fail ?? 0;
  const totalBatches = summary?.batches.total ?? 0;
  const runningBatches = summary?.batches.running ?? 0;
  const avgTemperaturePeak =
    heatLossData.length > 0
      ? Math.max(...heatLossData.map((d) => Number(d.events) || 0))
      : 0;
  const hiddenRecipes = recipes.filter((recipe) => !recipe.isActive);
  const hiddenUsedRecipes = hiddenRecipes.filter((recipe) => recipe.batchCount > 0);
  const activeRecipes = recipes.filter((recipe) => recipe.isActive).length;

  const managerAlerts = [
    ...(failBatches > 0
      ? [{
          key: 'fail-rate',
          type: failBatches > 10 ? 'error' : 'warning',
          title: 'Mẻ fail trong kỳ',
          message: `Có ${failBatches} mẻ fail trên tổng ${totalBatches} mẻ. Nên kiểm tra nguyên nhân theo lô và thiết bị liên quan.`,
        }]
      : []),
    ...(inactiveMachines > 0
      ? [{
          key: 'inactive-machine',
          type: 'warning',
          title: 'Thiết bị inactive',
          message: `Có ${inactiveMachines} thiết bị chưa hoạt động trong tổng ${totalMachines} thiết bị.`,
        }]
      : []),
    ...(hiddenUsedRecipes.length > 0
      ? [{
          key: 'hidden-recipe',
          type: 'info',
          title: 'Công thức bị ẩn có batch liên quan',
          message: `${hiddenUsedRecipes.length} công thức đang bị ẩn nhưng đã có batch tham chiếu. Chỉ nên ẩn, không xoá cứng.`,
        }]
      : []),
    ...(longRunningCount > 0
      ? [{
          key: 'long-running-batch',
          type: 'warning',
          title: 'Mẻ chạy quá lâu',
          message: `Có ${longRunningCount} mẻ đang chạy vượt ${LONG_RUNNING_THRESHOLD_HOURS} giờ chuẩn. Cần kiểm tra thiết bị hoặc công thức liên quan.`,
        }]
      : []),
  ];

  const goToBatches = (status: 'all' | 'running' | 'completed' | 'fail') => {
    router.push(status === 'all' ? '/manager/batches' : `/manager/batches?status=${status}`);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#262626' }}>
              Tổng quan Nhà máy
            </Title>
            <Text type="secondary">Số liệu sản xuất và trạng thái thiết bị theo thời gian thực.</Text>
          </div>
          <Space wrap>
            <RangePicker
              value={range}
              onChange={(next) => {
                if (!next || !next[0] || !next[1]) return;
                setRange([next[0], next[1]]);
              }}
              style={{ borderRadius: 7 }}
              placeholder={['Từ ngày', 'Đến ngày']}
            />
            <Select
              value={zone}
              onChange={setZone}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: 'Toàn nhà máy' },
                { value: 'zoneA', label: 'Buồng sấy A' },
              ]}
            />
            <Button type="primary" icon={<ExportOutlined />} onClick={() => router.push('/manager/reports')}>
              Xuất báo cáo
            </Button>
          </Space>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* Operational Alerts */}
          {managerAlerts.length > 0 && (
            <Card title="Cảnh báo vận hành" style={{ borderRadius: 7, marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {managerAlerts.map((alert) => (
                  <Alert
                    key={alert.key}
                    type={alert.type as 'error' | 'warning' | 'info'}
                    showIcon
                    message={alert.title}
                    description={alert.message}
                  />
                ))}
              </Space>
            </Card>
          )}

          {/* Summary Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card
                hoverable
                onClick={() => goToBatches('all')}
                style={{ borderRadius: 7, borderBottom: '3px solid #1677ff', cursor: 'pointer' }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>Tổng mẻ trong kỳ</Text>
                    <div style={{ fontSize: 40, fontWeight: 700, color: '#52c41a', lineHeight: 1.2, marginTop: 4 }}>
                      {totalBatches}
                    </div>
                    <Space style={{ marginTop: 8 }}>
                      <RiseOutlined style={{ color: '#1677ff' }} />
                      <Tag color="blue" style={{ borderRadius: 20, border: 'none' }}>Bấm để xem</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {summary?.range.from ? 'Drill-down sang danh sách mẻ' : 'Xem toàn bộ danh sách'}
                      </Text>
                    </Space>
                  </div>
                  <div style={{
                    width: 48, height: 48, borderRadius: 7,
                    background: '#e6f4ff', border: '1px solid #91caff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 22 }} />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                hoverable
                onClick={() => goToBatches('running')}
                style={{ borderRadius: 7, borderBottom: '3px solid #faad14', cursor: 'pointer' }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>Mẻ đang chạy</Text>
                    <div style={{ fontSize: 40, fontWeight: 700, color: '#8c8c8c', lineHeight: 1.2, marginTop: 4 }}>
                      {runningBatches}
                    </div>
                    <Space style={{ marginTop: 8 }}>
                      <PauseCircleOutlined style={{ color: '#faad14' }} />
                      <Tag color="warning" style={{ borderRadius: 20, border: 'none' }}>Bấm để lọc</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {runningBatches > 0 ? 'Đi tới danh sách đang chạy' : 'Không có mẻ chạy'}
                      </Text>
                    </Space>
                  </div>
                  <div style={{
                    width: 48, height: 48, borderRadius: 7,
                    background: '#fffbe6', border: '1px solid #ffe58f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <PauseCircleOutlined style={{ color: '#faad14', fontSize: 22 }} />
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                hoverable
                onClick={() => goToBatches('fail')}
                style={{ borderRadius: 7, borderBottom: '3px solid #ff4d4f', cursor: 'pointer' }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>Mẻ fail</Text>
                    <div style={{ fontSize: 40, fontWeight: 700, color: '#ff4d4f', lineHeight: 1.2, marginTop: 4 }}>
                      {failBatches}
                    </div>
                    <Space style={{ marginTop: 8 }}>
                      <WarningOutlined style={{ color: '#ff4d4f' }} />
                      <Tag color={failBatches > 0 ? 'error' : 'default'} style={{ borderRadius: 20, border: 'none' }}>
                        {failBatches > 0 ? 'Cần chú ý' : 'Ổn định'}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Fail trong kỳ: {failBatches}/{totalBatches}
                      </Text>
                    </Space>
                  </div>
                  <div style={{
                    width: 48, height: 48, borderRadius: 7,
                    background: '#fff2f0', border: '1px solid #ffccc7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <WarningOutlined style={{ color: '#ff4d4f', fontSize: 22 }} />
                  </div>
                </div>
                <Text style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4, display: 'block' }}>
                  Tỉ lệ fail: {summary?.batches.failRate ?? 0}%
                </Text>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{ borderRadius: 7, borderBottom: '3px solid #52c41a', cursor: 'default' }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 13 }}>Máy đang hoạt động</Text>
                    <div style={{ fontSize: 40, fontWeight: 700, color: '#52c41a', lineHeight: 1.2, marginTop: 4 }}>
                      {activeMachines}
                      <span style={{ fontSize: 20, color: '#8c8c8c', fontWeight: 400 }}>/
                        {totalMachines}
                      </span>
                    </div>
                    <Space style={{ marginTop: 8 }}>
                      <RiseOutlined style={{ color: '#52c41a' }} />
                      <Tag color="success" style={{ borderRadius: 20, border: 'none' }}>Đang chạy</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {activeRecipes} công thức đang hiện
                      </Text>
                    </Space>
                  </div>
                  <div style={{
                    width: 48, height: 48, borderRadius: 7,
                    background: '#f6ffed', border: '1px solid #b7eb8f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ThunderboltOutlined style={{ color: '#52c41a', fontSize: 22 }} />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Middle: Bar Chart + Donut Chart */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {/* Bar Chart */}
            <Col xs={24} lg={16}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>
                      Success / Fail theo {trendPeriod === 'day' ? 'ngày' : trendPeriod === 'week' ? 'tuần' : trendPeriod === 'month' ? 'tháng' : 'năm'}
                    </span>
                    <Select
                      value={trendPeriod}
                      onChange={setTrendPeriod}
                      style={{ width: 140 }}
                      options={[
                        { value: 'day', label: 'Theo ngày' },
                        { value: 'week', label: 'Theo tuần' },
                        { value: 'month', label: 'Theo tháng' },
                        { value: 'year', label: 'Theo năm' },
                      ]}
                    />
                  </div>
                }
                style={{ borderRadius: 7, height: '100%' }}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={batchByZoneData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="zone" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ReTooltip contentStyle={{ borderRadius: 7, border: '1px solid #f0f0f0' }} />
                    <Legend iconType="circle" iconSize={8} />
                    <Bar dataKey="success" name="Success" fill="#1677ff" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fail" name="Fail" fill="#ff7875" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* Donut Chart */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <div>
                    <div style={{ fontWeight: 600 }}>Mục tiêu tháng</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>Tỉ lệ Success/Fail thực tế</div>
                  </div>
                }
                style={{ borderRadius: 7, height: '100%' }}
              >
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <PieChart width={220} height={220}>
                    <Pie
                      data={completionData}
                      cx={110}
                      cy={110}
                      innerRadius={70}
                      outerRadius={100}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      strokeWidth={0}
                    >
                      {completionData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div style={{
                    position: 'absolute',
                    textAlign: 'center',
                    pointerEvents: 'none',
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>{successRate.toFixed(1)}%</div>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>Success</div>
                  </div>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
                  <Space>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1677ff', display: 'inline-block' }} />
                    <Text type="secondary" style={{ fontSize: 13 }}>Success</Text>
                  </Space>
                  <Text strong>{summary?.batches.success ?? 0} mẻ</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px 0' }}>
                  <Space>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e6f4ff', border: '1px solid #91caff', display: 'inline-block' }} />
                    <Text type="secondary" style={{ fontSize: 13 }}>Fail</Text>
                  </Space>
                  <Text strong>{summary?.batches.fail ?? 0} mẻ</Text>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Bottom: Temperature Chart + MTBF */}
          <Row gutter={[16, 16]}>
            {/* Temperature Line Chart */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Nhiệt độ trung bình theo giờ</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>
                        Biểu đồ lấy từ SensorDataLog thật
                      </div>
                    </div>
                    <Tag color="error" style={{ borderRadius: 20 }}>
                      <ArrowUpOutlined /> Peak {avgTemperaturePeak.toFixed(1)}°C
                    </Tag>
                  </div>
                }
                style={{ borderRadius: 7 }}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={heatLossData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="heatGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff4d4f" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ff4d4f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ReTooltip
                      contentStyle={{ borderRadius: 7, border: '1px solid #f0f0f0' }}
                      formatter={(val) => [`${val} °C`, 'Nhiệt độ TB']}
                    />
                    <Area
                      type="monotone"
                      dataKey="events"
                      stroke="#ff4d4f"
                      strokeWidth={2}
                      fill="url(#heatGrad)"
                      dot={<CustomDot />}
                      activeDot={{ r: 6, fill: '#ff4d4f' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            {/* MTBF Analysis */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>Phân tích MTBF Thiết bị</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>Thời gian trung bình giữa các lần hỏng hóc</div>
                    </div>
                    <Button type="text" icon={<MoreOutlined />} />
                  </div>
                }
                style={{ borderRadius: 7 }}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  {mtbfData.map((item, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 7,
                            background: '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <ThunderboltOutlined style={{ fontSize: 20, color: item.progressColor }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 14 }}>{item.name}</Text>
                            <Tag
                              color={
                                item.risk === 'High Risk' ? 'error' :
                                  item.risk === 'Optimal' ? 'success' : 'warning'
                              }
                              style={{ borderRadius: 20, border: 'none', fontSize: 11 }}
                            >
                              {item.risk === 'High Risk' ? 'Rủi ro cao' : item.risk === 'Optimal' ? 'Tốt' : 'Theo dõi'}
                            </Tag>
                          </div>
                          <Text type="secondary" style={{ fontSize: 12 }}>{item.subtitle}</Text>
                        </div>
                      </div>
                      <Progress
                        percent={item.progress}
                        showInfo={false}
                        strokeColor={item.progressColor}
                        trailColor="#f5f5f5"
                        style={{ margin: 0 }}
                      />
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
