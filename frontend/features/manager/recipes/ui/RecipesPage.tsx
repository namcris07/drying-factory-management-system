"use client";

/**
 * app/(manager)/recipes/page.tsx
 * Thư viện Công thức sấy — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import { Typography, Card, Row, Col, Tag, Button, Space, Input, Table, Spin, App, Modal } from 'antd';
import { BookOutlined, PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { recipesApi, ApiRecipe } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function RecipesPage() {
  const { message, modal } = App.useApp();
  const [recipes, setRecipes] = useState<ApiRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadRecipes = async () => {
    try {
      const data = await recipesApi.getAll();
      setRecipes(data);
    } catch {
      message.error('Không thể tải danh sách công thức.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecipes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = (recipe: ApiRecipe) => {
    modal.confirm({
      title: `Xóa công thức "${recipe.recipeName}"?`,
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await recipesApi.remove(recipe.recipeID);
          message.success('Đã xóa công thức.');
          await loadRecipes();
        } catch {
          message.error('Xóa công thức thất bại.');
        }
      },
    });
  };

  const filtered = recipes.filter(r =>
    (r.recipeName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (r.recipeFruits ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { title: 'ID', dataIndex: 'recipeID', width: 60 },
    { title: 'Tên công thức', dataIndex: 'recipeName', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Loại trái cây', dataIndex: 'recipeFruits', render: (v: string) => <Tag color="green">{v}</Tag> },
    {
      title: 'Thời gian ước tính',
      dataIndex: 'timeDurationEst',
      render: (v: number) => v ? `${Math.round(v / 60)}h ${v % 60}m` : '—',
    },
    {
      title: 'Số bước',
      key: 'steps',
      render: (_: unknown, r: ApiRecipe) => r.steps?.length ?? 0,
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: unknown, record: ApiRecipe) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
        </Space>
      ),
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

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
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm công thức..."
            style={{ width: 220 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
          />
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
            <div style={{ fontSize: 32, fontWeight: 700, color: '#52c41a' }}>
              {new Set(recipes.map(r => r.recipeFruits).filter(Boolean)).size}
            </div>
            <Text type="secondary">Loại trái cây</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#faad14' }}>
              {recipes.reduce((sum, r) => sum + (r.steps?.length ?? 0), 0)}
            </div>
            <Text type="secondary">Tổng bước sấy</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#8c8c8c' }}>
              {recipes.filter(r => (r.timeDurationEst ?? 0) > 600).length}
            </div>
            <Text type="secondary">Quy trình dài (&gt;10h)</Text>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="recipeID"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
