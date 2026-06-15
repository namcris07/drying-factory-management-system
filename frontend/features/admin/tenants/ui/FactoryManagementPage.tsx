"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Button,
  Space,
  Table,
  Spin,
  App,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Tag,
  Empty,
  Statistic,
} from 'antd';
import {
  BuildOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { factoriesApi, ApiFactory, organizationsApi, ApiOrganization } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function FactoryManagementPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ factoryName: string; factoryCode: string; organizationID: number; status: string }>();
  const [factories, setFactories] = useState<ApiFactory[]>([]);
  const [orgs, setOrgs] = useState<ApiOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<ApiFactory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orgFilter, setOrgFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [factoryRows, orgRows] = await Promise.all([
        factoriesApi.getAll(),
        organizationsApi.getAll(),
      ]);
      setFactories(factoryRows);
      setOrgs(orgRows);
    } catch {
      message.error('Không thể tải danh sách nhà máy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const total = factories.length;
    const active = factories.filter(f => f.status === 'Active').length;
    const totalSites = factories.reduce((sum, f) => sum + (f._count?.sites ?? 0), 0);
    const totalChambers = factories.reduce((sum, f) => sum + (f._count?.devices ?? 0), 0);
    return { total, active, totalSites, totalChambers };
  }, [factories]);

  const filteredFactories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return factories.filter((factory) => {
      if (statusFilter !== 'all' && factory.status !== statusFilter) return false;
      if (orgFilter !== 'all' && factory.organizationID !== orgFilter) return false;

      if (!q) return true;
      const name = String(factory.factoryName ?? '').toLowerCase();
      const code = String(factory.factoryCode ?? '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [factories, searchQuery, orgFilter, statusFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setOrgFilter('all');
    setStatusFilter('all');
  };

  const openCreate = () => {
    setEditingFactory(null);
    form.setFieldsValue({
      factoryName: '',
      factoryCode: '',
      organizationID: orgs[0]?.organizationID || undefined!,
      status: 'Active',
    });
    setModalOpen(true);
  };

  const openEdit = (factory: ApiFactory) => {
    setEditingFactory(factory);
    form.setFieldsValue({
      factoryName: factory.factoryName ?? '',
      factoryCode: factory.factoryCode ?? '',
      organizationID: factory.organizationID ?? undefined!,
      status: factory.status ?? 'Active',
    });
    setModalOpen(true);
  };

  const saveFactory = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        factoryName: String(values.factoryName ?? '').trim(),
        organizationID: values.organizationID,
        status: values.status,
      };

      if (editingFactory) {
        await factoriesApi.update(editingFactory.factoryID, payload);
        message.success('Đã cập nhật nhà máy.');
      } else {
        await factoriesApi.create(payload);
        message.success('Đã tạo nhà máy mới.');
      }

      setModalOpen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Lỗi khi lưu nhà máy.';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const removeFactory = async (id: number) => {
    try {
      await factoriesApi.remove(id);
      message.success('Đã xóa nhà máy.');
      await loadData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể xóa nhà máy. Vui lòng kiểm tra các phân xưởng và thiết bị liên kết.';
      message.error(msg);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'factoryID', width: 80 },
    {
      title: 'Tên Nhà máy',
      dataIndex: 'factoryName',
      render: (v: string | null) => <Text strong>{v ?? '—'}</Text>,
      width: 200,
    },
    {
      title: 'Mã Nhà máy',
      dataIndex: 'factoryCode',
      render: (v: string | null) => <Tag color="blue">{v ?? '—'}</Tag>,
      width: 130,
    },
    {
      title: 'Tổ chức trực thuộc',
      dataIndex: ['organization', 'organizationName'],
      render: (v: string | null) => <Text>{v ?? '—'}</Text>,
      width: 200,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: string | null) => (
        <Tag color={v === 'Active' ? 'green' : 'red'}>
          {v === 'Active' ? 'Đang hoạt động' : 'Tạm dừng'}
        </Tag>
      ),
      width: 130,
    },
    {
      title: 'Số Phân xưởng',
      key: 'sitesCount',
      render: (_: unknown, r: ApiFactory) => r._count?.sites ?? 0,
      width: 120,
    },
    {
      title: 'Số Buồng sấy',
      key: 'chambersCount',
      render: (_: unknown, r: ApiFactory) => r._count?.devices ?? 0,
      width: 120,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 160,
      render: (_: unknown, factory: ApiFactory) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(factory)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa nhà máy này? Hành động này không thể hoàn tác."
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => void removeFactory(factory.factoryID)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
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
            <BuildOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Quản lý Nhà máy
          </Title>
          <Text type="secondary">Cấu hình các nhà máy sấy trực thuộc các tổ chức doanh nghiệp.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            Tải lại
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm Nhà máy
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng số Nhà máy" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Đang hoạt động" value={stats.active} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng số Phân xưởng" value={stats.totalSites} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng số Buồng sấy" value={stats.totalChambers} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
          <Space wrap>
            <Input.Search
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm tên hoặc mã nhà máy..."
              allowClear
              style={{ width: 250 }}
            />
            <Select
              value={orgFilter}
              onChange={(value) => setOrgFilter(value)}
              style={{ width: 200 }}
              placeholder="Lọc theo tổ chức"
              options={[
                { value: 'all', label: 'Tất cả tổ chức' },
                ...orgs.map(o => ({ value: o.organizationID, label: o.organizationName ?? `Org ${o.organizationID}` })),
              ]}
            />
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 160 }}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'Active', label: 'Đang hoạt động' },
                { value: 'Inactive', label: 'Tạm dừng' },
              ]}
            />
            <Button onClick={resetFilters}>Xóa lọc</Button>
          </Space>
          <Text type="secondary">Hiển thị {filteredFactories.length}/{factories.length} nhà máy</Text>
        </Space>
        <Table
          dataSource={filteredFactories}
          columns={columns}
          rowKey="factoryID"
          pagination={{ defaultPageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: <Empty description="Chưa có nhà máy" /> }}
        />
      </Card>

      <Modal
        title={editingFactory ? 'Sửa Nhà máy' : 'Thêm Nhà máy'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveFactory()}
        confirmLoading={saving}
        okText={editingFactory ? 'Lưu thay đổi' : 'Tạo mới'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="factoryName"
            label="Tên Nhà máy"
            rules={[{ required: true, message: 'Vui lòng nhập tên nhà máy.' }]}
          >
            <Input placeholder="Ví dụ: Nhà máy Bình Dương" />
          </Form.Item>
          {editingFactory && (
            <Form.Item
              name="factoryCode"
              label="Mã Nhà máy (Tự động sinh)"
            >
              <Input disabled />
            </Form.Item>
          )}
          <Form.Item
            name="organizationID"
            label="Tổ chức trực thuộc"
            rules={[{ required: true, message: 'Vui lòng chọn tổ chức trực thuộc.' }]}
          >
            <Select
              placeholder="Chọn tổ chức"
              options={orgs.map(o => ({ value: o.organizationID, label: o.organizationName ?? `Org ${o.organizationID}` }))}
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái.' }]}
          >
            <Select
              options={[
                { value: 'Active', label: 'Đang hoạt động' },
                { value: 'Inactive', label: 'Tạm dừng' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}
