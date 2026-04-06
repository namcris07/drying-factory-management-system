"use client";

/**
 * app/(manager)/recipes/page.tsx
 * Thư viện Công thức sấy — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Table,
  Spin,
  App,
  Form,
  Modal,
  InputNumber,
  Divider,
} from 'antd';
import {
  BookOutlined,
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { recipesApi, ApiRecipe, RecipeStagePayload, RecipeStepPayload } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function RecipesPage() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const [recipes, setRecipes] = useState<ApiRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 10 });
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<ApiRecipe | null>(null);

  const loadRecipes = async () => {
    try {
      const data = await recipesApi.getAll({ includeInactive: true });
      setRecipes(data);
    } catch {
      message.error('Không thể tải danh sách công thức.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRecipes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreateModal = () => {
    setEditingRecipe(null);
    form.setFieldsValue({
      recipeName: '',
      recipeFruits: '',
      timeDurationEst: 120,
      stages: [
        {
          stageOrder: 1,
          durationMinutes: 60,
          temperatureSetpoint: 55,
          humiditySetpoint: 30,
        },
      ],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (recipe: ApiRecipe) => {
    setEditingRecipe(recipe);
    const mappedStages = (recipe.stages ?? []).length > 0
      ? recipe.stages
      : (recipe.steps ?? []).map((step, idx) => ({
        stageOrder: step.stepNo ?? idx + 1,
        durationMinutes: step.durationMinutes ?? 30,
        temperatureSetpoint: step.temperatureGoal ?? 50,
        humiditySetpoint: step.humidityGoal ?? 30,
      }));

    form.setFieldsValue({
      recipeName: recipe.recipeName ?? '',
      recipeFruits: recipe.recipeFruits ?? '',
      timeDurationEst: recipe.timeDurationEst ?? 60,
      stages: mappedStages,
    });
    setIsModalOpen(true);
  };

  const handleSaveRecipe = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const rawStages = Array.isArray(values.stages) ? values.stages : [];
      const normalizedStages: RecipeStagePayload[] = rawStages
        .map((stage: {
          stageOrder: number;
          durationMinutes: number;
          temperatureSetpoint: number;
          humiditySetpoint: number;
        }, idx: number) => ({
          stageOrder: Number(stage.stageOrder ?? idx + 1),
          durationMinutes: Number(stage.durationMinutes),
          temperatureSetpoint: Number(stage.temperatureSetpoint),
          humiditySetpoint: Number(stage.humiditySetpoint),
        }))
        .sort(
          (a: RecipeStagePayload, b: RecipeStagePayload) =>
            a.stageOrder - b.stageOrder,
        );

      const derivedSteps: RecipeStepPayload[] = normalizedStages.map((stage) => ({
        stepNo: stage.stageOrder,
        durationMinutes: stage.durationMinutes,
        temperatureGoal: stage.temperatureSetpoint,
        humidityGoal: stage.humiditySetpoint,
        fanStatus: 'On',
      }));

      const payload = {
        recipeName: String(values.recipeName).trim(),
        recipeFruits: String(values.recipeFruits ?? '').trim() || undefined,
        timeDurationEst: Number(values.timeDurationEst),
        stages: normalizedStages,
        steps: derivedSteps,
      };

      if (editingRecipe) {
        await recipesApi.update(editingRecipe.recipeID, payload);
        message.success('Đã cập nhật công thức và RecipeStage.');
      } else {
        await recipesApi.create(payload);
        message.success('Đã tạo công thức mới cùng RecipeStage.');
      }

      setIsModalOpen(false);
      await loadRecipes();
    } catch {
      // Validation/API error is surfaced by form/message.
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (recipe: ApiRecipe) => {
    if (recipe.batchCount > 0) {
      return;
    }

    modal.confirm({
      title: `Xóa vĩnh viễn công thức "${recipe.recipeName}"?`,
      content: 'Chỉ nên xóa khi công thức chưa từng được dùng cho mẻ nào.',
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const result = await recipesApi.remove(recipe.recipeID);
          if (result.action === 'deleted') {
            message.success('Đã xóa vĩnh viễn công thức.');
          } else {
            message.info('Công thức đã được ẩn vì đã có mẻ tham chiếu.');
          }
          await loadRecipes();
        } catch {
          message.error('Xóa công thức thất bại.');
        }
      },
    });
  };

  const handleToggleVisibility = async (recipe: ApiRecipe, nextIsActive: boolean) => {
    try {
      await recipesApi.update(recipe.recipeID, { isActive: nextIsActive });
      message.success(nextIsActive ? 'Đã hiển thị lại công thức.' : 'Đã ẩn công thức.');
      await loadRecipes();
    } catch {
      message.error('Cập nhật trạng thái công thức thất bại.');
    }
  };

  const filtered = recipes.filter((r) => {
    const matchedKeyword =
      (r.recipeName ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (r.recipeFruits ?? '').toLowerCase().includes(search.toLowerCase());

    const matchedVisibility =
      visibilityFilter === 'all' ||
      (visibilityFilter === 'active' && r.isActive) ||
      (visibilityFilter === 'inactive' && !r.isActive);

    return matchedKeyword && matchedVisibility;
  });

  useEffect(() => {
    setTablePagination((prev) => ({ ...prev, current: 1 }));
  }, [search, visibilityFilter]);

  const columns = [
    { title: 'ID', dataIndex: 'recipeID', width: 60 },
    { title: 'Tên công thức', dataIndex: 'recipeName', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Loại trái cây', dataIndex: 'recipeFruits', render: (v: string) => <Tag color="green">{v}</Tag> },
    {
      title: 'Trạng thái',
      key: 'isActive',
      render: (_: unknown, r: ApiRecipe) => (
        <Tag color={r.isActive ? 'success' : 'default'}>
          {r.isActive ? 'Hiện' : 'Ẩn'}
        </Tag>
      ),
    },
    {
      title: 'Số mẻ đã dùng',
      dataIndex: 'batchCount',
      render: (v: number) => v ?? 0,
    },
    {
      title: 'Thời gian ước tính',
      dataIndex: 'timeDurationEst',
      render: (v: number) => v ? `${Math.round(v / 60)}h ${v % 60}m` : '—',
    },
    {
      title: 'Số stage',
      key: 'stages',
      render: (_: unknown, r: ApiRecipe) => r.stages?.length ?? r.steps?.length ?? 0,
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: unknown, record: ApiRecipe) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          <Button
            size="small"
            icon={record.isActive ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => void handleToggleVisibility(record, !record.isActive)}
          >
            {record.isActive ? 'Ẩn' : 'Hiện'}
          </Button>
          {record.batchCount === 0 && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
              Xóa
            </Button>
          )}
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
          <Select
            style={{ width: 150 }}
            value={visibilityFilter}
            onChange={(value: 'all' | 'active' | 'inactive') => setVisibilityFilter(value)}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'active', label: 'Đang hiện' },
              { value: 'inactive', label: 'Đang ẩn' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm công thức
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1677ff' }}>{recipes.filter((r) => r.isActive).length}</div>
            <Text type="secondary">Công thức đang hiện</Text>
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
              {recipes.reduce((sum, r) => sum + (r.batchCount ?? 0), 0)}
            </div>
            <Text type="secondary">Tổng lượt dùng trong mẻ</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#8c8c8c' }}>
              {recipes.filter((r) => !r.isActive).length}
            </div>
            <Text type="secondary">Công thức đang ẩn</Text>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="recipeID"
          pagination={{
            current: tablePagination.current,
            pageSize: tablePagination.pageSize,
            total: filtered.length,
            showSizeChanger: true,
            showQuickJumper: false,
            pageSizeOptions: ['10', '20', '30'],
            onChange: (current, pageSize) => {
              setTablePagination({ current, pageSize });
            },
          }}
        />
      </Card>

      <Modal
        title={editingRecipe ? 'Chỉnh sửa công thức' : 'Tạo công thức mới'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => void handleSaveRecipe()}
        okText={editingRecipe ? 'Lưu thay đổi' : 'Tạo công thức'}
        cancelText="Hủy"
        width={920}
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item
                label="Tên công thức"
                name="recipeName"
                rules={[{ required: true, message: 'Vui lòng nhập tên công thức.' }]}
              >
                <Input placeholder="Ví dụ: Xoài sấy dẻo" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Loại trái cây" name="recipeFruits">
                <Input placeholder="Ví dụ: Xoài" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                label="Tổng thời gian (phút)"
                name="timeDurationEst"
                rules={[{ required: true, message: 'Vui lòng nhập thời gian.' }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ marginTop: 0 }}>RecipeStage</Divider>

          <Form.List name="stages">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }} size={10}>
                {fields.map((field, index) => (
                  <Card key={field.key} size="small" style={{ borderRadius: 10 }}>
                    <Row gutter={10} align="middle">
                      <Col span={4}>
                        <Form.Item
                          {...field}
                          label="Thứ tự"
                          name={[field.name, 'stageOrder']}
                          rules={[{ required: true, message: 'Nhập thứ tự.' }]}
                        >
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...field}
                          label="Thời lượng (phút)"
                          name={[field.name, 'durationMinutes']}
                          rules={[{ required: true, message: 'Nhập thời lượng.' }]}
                        >
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...field}
                          label="Nhiệt độ setpoint"
                          name={[field.name, 'temperatureSetpoint']}
                          rules={[{ required: true, message: 'Nhập setpoint nhiệt độ.' }]}
                        >
                          <InputNumber min={0} max={150} style={{ width: '100%' }} addonAfter="°C" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...field}
                          label="Độ ẩm setpoint"
                          name={[field.name, 'humiditySetpoint']}
                          rules={[{ required: true, message: 'Nhập setpoint độ ẩm.' }]}
                        >
                          <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
                        </Form.Item>
                      </Col>
                      <Col span={2}>
                        <Button
                          danger
                          type="text"
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                          disabled={fields.length <= 1}
                          style={{ marginTop: 28 }}
                        />
                      </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Stage {index + 1}: Hệ thống dùng dữ liệu này để auto chuyển giai đoạn khi Batch đang chạy.
                    </Text>
                  </Card>
                ))}

                <Button
                  type="dashed"
                  onClick={() =>
                    add({
                      stageOrder: fields.length + 1,
                      durationMinutes: 30,
                      temperatureSetpoint: 55,
                      humiditySetpoint: 30,
                    })
                  }
                  block
                  icon={<PlusOutlined />}
                >
                  Thêm Stage
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
