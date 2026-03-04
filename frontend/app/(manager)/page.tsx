"use client";

/**
 * app/(manager)/page.tsx
 * Dashboard KPI cho Manager
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Tooltip,
  DatePicker,
  Divider,
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

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const batchByZoneData = [
  { zone: '08:00', zoneA: 9, zoneB: 5, projected: 12 },
  { zone: '09:00', zoneA: 18, zoneB: 11, projected: 20 },
  { zone: '10:00', zoneA: 15, zoneB: 10, projected: 18 },
  { zone: '11:00', zoneA: 13, zoneB: 7, projected: 15 },
  { zone: '12:00', zoneA: 16, zoneB: 8, projected: 17 },
  { zone: '13:00', zoneA: 14, zoneB: 6, projected: 16 },
  { zone: '14:00', zoneA: 21, zoneB: 14, projected: 22 },
  { zone: '15:00', zoneA: 17, zoneB: 10, projected: 19 },
];

const completionData = [
  { name: 'Hoàn thành', value: 42, color: '#1677ff' },
  { name: 'Còn lại', value: 6, color: '#e6f4ff' },
];

const heatLossData = [
  { day: 'Mon', events: 4 },
  { day: 'Tue', events: 7 },
  { day: 'Wed', events: 10 },
  { day: 'Thu', events: 6 },
  { day: 'Fri', events: 13 },
  { day: 'Sat', events: 5 },
  { day: 'Sun', events: 3 },
];

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

const CustomDot = (props: CustomDotProps) => {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;
  return <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#ff4d4f" strokeWidth={2} />;
};

export default function DashboardPage() {
  const router = useRouter();
  const [zone, setZone] = useState('all');

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
              style={{ borderRadius: 7 }}
              placeholder={['Từ ngày', 'Đến ngày']}
            />
            <Select
              value={zone}
              onChange={setZone}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: 'Tất cả khu vực' },
                { value: 'zoneA', label: 'Zone A' },
                { value: 'zoneB', label: 'Zone B' },
                { value: 'zoneC', label: 'Zone C' },
              ]}
            />
            <Button type="primary" icon={<ExportOutlined />}>
              Xuất báo cáo
            </Button>
          </Space>
        </div>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* Active Machines */}
        <Col xs={24} sm={8}>
          <Card
            style={{ borderRadius: 7, borderBottom: '3px solid #52c41a', cursor: 'default' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>Máy đang hoạt động</Text>
                <div style={{ fontSize: 40, fontWeight: 700, color: '#52c41a', lineHeight: 1.2, marginTop: 4 }}>
                  12<span style={{ fontSize: 20, color: '#8c8c8c', fontWeight: 400 }}>/15</span>
                </div>
                <Space style={{ marginTop: 8 }}>
                  <RiseOutlined style={{ color: '#52c41a' }} />
                  <Tag color="success" style={{ borderRadius: 20, border: 'none' }}>Đang chạy</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>80% công suất</Text>
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

        {/* Standby */}
        <Col xs={24} sm={8}>
          <Card
            style={{ borderRadius: 7, borderBottom: '3px solid #faad14', cursor: 'default' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>Chờ / Nghỉ</Text>
                <div style={{ fontSize: 40, fontWeight: 700, color: '#8c8c8c', lineHeight: 1.2, marginTop: 4 }}>2</div>
                <Space style={{ marginTop: 8 }}>
                  <PauseCircleOutlined style={{ color: '#faad14' }} />
                  <Tag color="warning" style={{ borderRadius: 20, border: 'none' }}>Chờ lệnh</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>Bảo trì định kỳ</Text>
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

        {/* Critical Errors */}
        <Col xs={24} sm={8}>
          <Card
            style={{ borderRadius: 7, borderBottom: '3px solid #ff4d4f', cursor: 'pointer' }}
            styles={{ body: { padding: '20px 24px' } }}
            onClick={() => router.push('/operator/alerts?filter=error')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>Lỗi Nghiêm trọng</Text>
                <div style={{ fontSize: 40, fontWeight: 700, color: '#ff4d4f', lineHeight: 1.2, marginTop: 4 }}>1</div>
                <Space style={{ marginTop: 8 }}>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <Tag color="error" style={{ borderRadius: 20, border: 'none' }}>Cần xử lý</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>Zone B - Máy số 4</Text>
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
            <Tooltip title="Nhấn để xem chi tiết lỗi">
              <Text style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4, display: 'block' }}>
                → Nhấn để xử lý
              </Text>
            </Tooltip>
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
                <span style={{ fontWeight: 600 }}>Mẻ sấy theo Khu vực</span>
                <Button type="link" size="small" style={{ padding: 0 }}>Xem báo cáo</Button>
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
                <Bar dataKey="zoneA" name="Zone A" fill="#1677ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="zoneB" name="Zone B" fill="#69b1ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="projected" name="Dự kiến" fill="#bae0ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Donut Chart */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <div>
                <div style={{ fontWeight: 600 }}>Mục tiêu ngày</div>
                <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>Tiến độ so với kế hoạch</div>
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
                <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>87%</div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>Hoàn thành</div>
              </div>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
              <Space>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1677ff', display: 'inline-block' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>Đã hoàn thành</Text>
              </Space>
              <Text strong>42 mẻ</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px 0' }}>
              <Space>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e6f4ff', border: '1px solid #91caff', display: 'inline-block' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>Còn lại</Text>
              </Space>
              <Text strong>6 mẻ</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Bottom: Heat Loss Chart + MTBF */}
      <Row gutter={[16, 16]}>
        {/* Heat Loss Line Chart */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Sự kiện mất nhiệt</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400 }}>
                    Nhiệt độ giảm &gt; 5°C (mở cửa, rò rỉ)
                  </div>
                </div>
                <Tag color="error" style={{ borderRadius: 20 }}>
                  <ArrowUpOutlined /> +2.4% so với tuần trước
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
                  formatter={(val) => [`${val} sự kiện`, 'Cửa mở']}
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
    </div>
  );
}
