"use client";

/**
 * app/(admin)/admin/zones/page.tsx
 * Quản lý Khu vực
 */
import { Typography, Card, Row, Col, Button, Tag, Space, Table, Progress } from 'antd';
import { GlobalOutlined, PlusOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import { initialZones } from '@/features/admin/model/admin-data';

const { Title, Text } = Typography;

export default function ZoneManagementPage() {
  const columns = [
    { title: 'Mã Zone', dataIndex: 'id', width: 100 },
    { title: 'Tên khu vực', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Số máy', dataIndex: 'machineCount' },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: string) => (
        <Tag color={v === 'Active' ? 'success' : 'default'}>
          {v === 'Active' ? 'Hoạt động' : 'Tạm ngưng'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: () => (
        <Space>
          <Button size="small" icon={<EditOutlined />} />
          <Button size="small" icon={<SettingOutlined />} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <GlobalOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Quản lý Khu vực
          </Title>
          <Text type="secondary">Cấu hình các Zone sản xuất trong nhà máy</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />}>
          Thêm khu vực
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1677ff' }}>{initialZones.length}</div>
            <Text type="secondary">Tổng Zone</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#52c41a' }}>
              {initialZones.filter(z => z.status === 'Active').length}
            </div>
            <Text type="secondary">Đang hoạt động</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#595959' }}>
              {initialZones.reduce((sum, z) => sum + z.machineCount, 0)}
            </div>
            <Text type="secondary">Tổng máy</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <Progress type="circle" percent={85} size={60} />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">Công suất TB</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={initialZones}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </div>
  );
}
