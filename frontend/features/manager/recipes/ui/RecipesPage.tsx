"use client";

/**
 * app/(manager)/recipes/page.tsx
 * Thư viện Công thức sấy
 */
import { Typography, Card, Row, Col, Tag, Button, Space, Input, Table } from 'antd';
import { BookOutlined, PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { recipes } from '@/features/operator/model/machine-data';

const { Title, Text } = Typography;

export default function RecipesPage() {
  const columns = [
    { title: 'Mã', dataIndex: 'id', width: 80 },
    { title: 'Tên công thức', dataIndex: 'name', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Loại trái cây', dataIndex: 'fruit', render: (v: string) => <Tag color="green">{v}</Tag> },
    { title: 'Nhiệt độ', dataIndex: 'temp', render: (v: number) => `${v}°C` },
    { title: 'Độ ẩm', dataIndex: 'humidity', render: (v: number) => `${v}%` },
    { title: 'Thời gian', dataIndex: 'duration', render: (v: number) => `${v}h` },
    {
      title: 'Thao tác',
      key: 'action',
      render: () => (
        <Space>
          <Button size="small" icon={<EditOutlined />} />
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <BookOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            Thư viện Công thức
          </Title>
          <Text type="secondary">Quản lý các công thức sấy chuẩn cho từng loại trái cây</Text>
        </div>
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="Tìm công thức..." style={{ width: 220 }} />
          <Button type="primary" icon={<PlusOutlined />}>
            Thêm công thức
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1677ff' }}>{recipes.length}</div>
            <Text type="secondary">Tổng công thức</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#52c41a' }}>5</div>
            <Text type="secondary">Đang sử dụng</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#faad14' }}>3</div>
            <Text type="secondary">Loại trái cây</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#8c8c8c' }}>2</div>
            <Text type="secondary">Đã lưu trữ</Text>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={recipes}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
