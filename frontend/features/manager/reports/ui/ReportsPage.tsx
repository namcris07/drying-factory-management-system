"use client";

/**
 * app/(manager)/reports/page.tsx
 * Xuất Báo cáo
 */
import { Typography, Card, Row, Col, Button, Space, DatePicker, Select, Divider } from 'antd';
import { FileTextOutlined, DownloadOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const reportTypes = [
  { icon: <FilePdfOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />, title: 'Báo cáo Hiệu suất', desc: 'Tổng hợp KPI sản xuất theo khu vực', format: 'PDF' },
  { icon: <FileExcelOutlined style={{ fontSize: 32, color: '#52c41a' }} />, title: 'Dữ liệu Mẻ sấy', desc: 'Chi tiết lịch sử các mẻ sấy', format: 'Excel' },
  { icon: <FilePdfOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />, title: 'Báo cáo Bảo trì', desc: 'Lịch sử và lịch bảo trì thiết bị', format: 'PDF' },
  { icon: <FileExcelOutlined style={{ fontSize: 32, color: '#52c41a' }} />, title: 'Dữ liệu Cảm biến', desc: 'Xuất dữ liệu nhiệt độ, độ ẩm', format: 'Excel' },
];

export default function ReportsPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 10, color: '#1677ff' }} />
          Xuất Báo cáo
        </Title>
        <Text type="secondary">Tạo và tải xuống các báo cáo sản xuất định kỳ</Text>
      </div>

      {/* Filters */}
      <Card style={{ borderRadius: 12, marginBottom: 24 }}>
        <Space wrap>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Khoảng thời gian</Text>
            <RangePicker style={{ borderRadius: 7 }} />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Khu vực</Text>
            <Select defaultValue="all" style={{ width: 160 }}>
              <Select.Option value="all">Tất cả khu vực</Select.Option>
              <Select.Option value="zoneA">Zone A</Select.Option>
              <Select.Option value="zoneB">Zone B</Select.Option>
              <Select.Option value="zoneC">Zone C</Select.Option>
            </Select>
          </div>
        </Space>
      </Card>

      <Divider orientation="left">Chọn loại báo cáo</Divider>

      {/* Report Types */}
      <Row gutter={[16, 16]}>
        {reportTypes.map((report, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card
              hoverable
              style={{ borderRadius: 12, textAlign: 'center', height: '100%' }}
            >
              <div style={{ marginBottom: 16 }}>{report.icon}</div>
              <Title level={5} style={{ margin: '0 0 8px' }}>{report.title}</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{report.desc}</Text>
              <Button type="primary" icon={<DownloadOutlined />} style={{ borderRadius: 7 }}>
                Tải {report.format}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
