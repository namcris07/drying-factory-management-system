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
  BankOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { organizationsApi, ApiOrganization } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function OrganizationManagementPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ organizationName: string; organizationCode: string; status: string }>();
  const [orgs, setOrgs] = useState<ApiOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<ApiOrganization | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const rows = await organizationsApi.getAll();
      setOrgs(rows);
    } catch {
      message.error('Không thể tải danh sách tổ chức.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const total = orgs.length;
    const active = orgs.filter(o => o.status === 'Active').length;
    const inactive = total - active;
    const totalFactories = orgs.reduce((sum, o) => sum + (o._count?.factories ?? 0), 0);
    return { total, active, inactive, totalFactories };
  }, [orgs]);

  const filteredOrgs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return orgs.filter((org) => {
      if (statusFilter !== 'all' && org.status !== statusFilter) return false;

      if (!q) return true;
      const name = String(org.organizationName ?? '').toLowerCase();
      const code = String(org.organizationCode ?? '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [orgs, searchQuery, statusFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  const openCreate = () => {
    setEditingOrg(null);
    form.setFieldsValue({ organizationName: '', organizationCode: '', status: 'Active' });
    setModalOpen(true);
  };

  const openEdit = (org: ApiOrganization) => {
    setEditingOrg(org);
    form.setFieldsValue({
      organizationName: org.organizationName ?? '',
      organizationCode: org.organizationCode ?? '',
      status: org.status ?? 'Active',
    });
    setModalOpen(true);
  };

  const saveOrg = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        organizationName: String(values.organizationName ?? '').trim(),
        status: values.status,
      };

      if (editingOrg) {
        await organizationsApi.update(editingOrg.organizationID, payload);
        message.success('Đã cập nhật tổ chức.');
      } else {
        await organizationsApi.create(payload);
        message.success('Đã tạo tổ chức mới.');
      }

      setModalOpen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Lỗi khi lưu tổ chức.';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const removeOrg = async (id: number) => {
    try {
      await organizationsApi.remove(id);
      message.success('Đã xóa tổ chức.');
      await loadData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể xóa tổ chức. Kiểm tra xem có nhà máy liên kết không.';
      message.error(msg);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'organizationID', width: 80 },
    {
      title: 'Tên Tổ chức',
      dataIndex: 'organizationName',
      render: (v: string | null) => <Text strong>{v ?? '—'}</Text>,
      width: 250,
    },
    {
      title: 'Mã Tổ chức',
      dataIndex: 'organizationCode',
      render: (v: string | null) => <Tag color="blue">{v ?? '—'}</Tag>,
      width: 150,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (v: string | null) => (
        <Tag color={v === 'Active' ? 'green' : 'red'}>
          {v === 'Active' ? 'Đang hoạt động' : 'Tạm khóa'}
        </Tag>
      ),
      width: 150,
    },
    {
      title: 'Số Nhà máy',
      key: 'factoriesCount',
      render: (_: unknown, r: ApiOrganization) => r._count?.factories ?? 0,
      width: 150,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 160,
      render: (_: unknown, org: ApiOrganization) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(org)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa tổ chức này? Hành động này không thể hoàn tác."
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => void removeOrg(org.organizationID)}
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
            <BankOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Quản lý Tổ chức
          </Title>
          <Text type="secondary">Cấu hình các tổng công ty, doanh nghiệp sử dụng hệ thống.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            Tải lại
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm Tổ chức
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng số Tổ chức" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Đang hoạt động" value={stats.active} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tạm khóa" value={stats.inactive} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng số Nhà máy" value={stats.totalFactories} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
          <Space wrap>
            <Input.Search
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm tên hoặc mã tổ chức..."
              allowClear
              style={{ width: 300 }}
            />
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'Active', label: 'Đang hoạt động' },
                { value: 'Inactive', label: 'Tạm khóa' },
              ]}
            />
            <Button onClick={resetFilters}>Xóa lọc</Button>
          </Space>
          <Text type="secondary">Hiển thị {filteredOrgs.length}/{orgs.length} tổ chức</Text>
        </Space>
        <Table
          dataSource={filteredOrgs}
          columns={columns}
          rowKey="organizationID"
          pagination={{ defaultPageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: <Empty description="Chưa có tổ chức" /> }}
        />
      </Card>

      <Modal
        title={editingOrg ? 'Sửa Tổ chức' : 'Thêm Tổ chức'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveOrg()}
        confirmLoading={saving}
        okText={editingOrg ? 'Lưu thay đổi' : 'Tạo mới'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="organizationName"
            label="Tên Tổ chức"
            rules={[{ required: true, message: 'Vui lòng nhập tên tổ chức.' }]}
          >
            <Input placeholder="Ví dụ: DryTech Việt Nam" />
          </Form.Item>
          {editingOrg && (
            <Form.Item
              name="organizationCode"
              label="Mã Tổ chức (Tự động sinh)"
            >
              <Input disabled />
            </Form.Item>
          )}
          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái.' }]}
          >
            <Select
              options={[
                { value: 'Active', label: 'Đang hoạt động' },
                { value: 'Inactive', label: 'Tạm khóa' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
}
