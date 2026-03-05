"use client";

/**
 * app/(manager)/ai/page.tsx
 * Phân tích Hiệu suất AI
 */
import { Typography, Card, Row, Col, Progress, Tag, Space, Alert } from 'antd';
import { BarChartOutlined, BulbOutlined, RiseOutlined, WarningOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const aiInsights = [
  {
    type: 'optimization',
    icon: <BulbOutlined style={{ color: '#faad14' }} />,
    title: 'Đề xuất tối ưu nhiệt độ',
    content: 'Giảm nhiệt độ Zone A xuống 2°C có thể tiết kiệm 8% năng lượng mà không ảnh hưởng chất lượng.',
  },
  {
    type: 'warning',
    icon: <WarningOutlined style={{ color: '#ff4d4f' }} />,
    title: 'Cảnh báo bảo trì',
    content: 'Máy M-B2 có dấu hiệu giảm hiệu suất 15% so với tuần trước. Nên kiểm tra động cơ quạt.',
  },
  {
    type: 'trend',
    icon: <RiseOutlined style={{ color: '#52c41a' }} />,
    title: 'Xu hướng tích cực',
    content: 'Tỷ lệ hoàn thành mẻ sấy đúng thời gian tăng 12% trong tháng này.',
  },
];

export default function AIAnalysisPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 10, color: '#1677ff' }} />
          Phân tích Hiệu suất AI
        </Title>
        <Text type="secondary">Insights và đề xuất dựa trên dữ liệu vận hành thực tế</Text>
      </div>

      <Alert
        message="AI Engine đang hoạt động"
        description="Phân tích dựa trên dữ liệu 30 ngày gần nhất — Cập nhật lần cuối: 5 phút trước"
        type="info"
        showIcon
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      {/* KPI Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Progress type="circle" percent={87} strokeColor="#52c41a" />
            <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>Hiệu suất OEE</Title>
            <Tag color="success">+3.2% so với tháng trước</Tag>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Progress type="circle" percent={92} strokeColor="#1677ff" />
            <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>Chất lượng sản phẩm</Title>
            <Tag color="blue">Ổn định</Tag>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Progress type="circle" percent={78} strokeColor="#faad14" />
            <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>Sử dụng năng lượng</Title>
            <Tag color="warning">Có thể tối ưu</Tag>
          </Card>
        </Col>
      </Row>

      {/* AI Insights */}
      <Title level={4}>
        <BulbOutlined style={{ marginRight: 8 }} />
        Đề xuất từ AI
      </Title>
      <Row gutter={[16, 16]}>
        {aiInsights.map((insight, i) => (
          <Col xs={24} md={8} key={i}>
            <Card style={{ borderRadius: 12, height: '100%' }}>
              <Space>
                {insight.icon}
                <Text strong>{insight.title}</Text>
              </Space>
              <Paragraph type="secondary" style={{ marginTop: 12 }}>
                {insight.content}
              </Paragraph>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
