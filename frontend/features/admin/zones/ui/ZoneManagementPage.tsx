"use client";

/**
 * app/(admin)/admin/zones/page.tsx
 * Quản lý Khu vực — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Button, Space, Table, Progress, Spin, App } from 'antd';
import { GlobalOutlined, PlusOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import { zonesApi, ApiZone } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function ZoneManagementPage() {
  const { message } = App.useApp();
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    zonesApi.getAll()
      .then(setZones)
      .catch(() => message.error('Không thể tải danh sách khu vực.'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { title: 'Mã Zone', dataIndex: 'zoneID', width: 100 },
    { title: 'Tên khu vực', dataIndex: 'zoneName', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Mô tả', dataIndex: 'zoneDescription' },
    { title: 'Số thiết bị', key: 'devices', render: (_: unknown, r: ApiZone) => r.devices?.length ?? 0 },
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

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

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
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1677ff' }}>{zones.length}</div>
            <Text type="secondary">Tổng Zone</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#52c41a' }}>
              {zones.length}
            </div>
            <Text type="secondary">Đang hoạt động</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#595959' }}>
              {zones.reduce((sum, z) => sum + (z.devices?.length ?? 0), 0)}
            </div>
            <Text type="secondary">Tổng thiết bị</Text>
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
          dataSource={zones}
          columns={columns}
          rowKey="zoneID"
          pagination={false}
        />
      </Card>
    </div>
  );
}
