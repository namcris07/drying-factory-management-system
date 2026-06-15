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
  BranchesOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { sitesApi, ApiSite, factoriesApi, ApiFactory } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function SiteManagementPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ siteName: string; siteCode: string; factoryID: number; status: string }>();
  const [sites, setSites] = useState<ApiSite[]>([]);
  const [factories, setFactories] = useState<ApiFactory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<ApiSite | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [factoryFilter, setFactoryFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [siteRows, factoryRows] = await Promise.all([
        sitesApi.getAll(),
        factoriesApi.getAll(),
      ]);
      setSites(siteRows);
      setFactories(factoryRows);
    } catch {
      message.error('Không thể tải danh sách phân xưởng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const total = sites.length;
    const active = sites.filter(s => s.status === 'Active').length;
    const totalZones = sites.reduce((sum, s) => sum + (s._count?.zones ?? 0), 0);
    const totalChambers = sites.reduce((sum, s) => sum + (s._count?.devices ?? 0), 0);
    return { total, active, totalZones, totalChambers };
  }, [sites]);

  const filteredSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return sites.filter((site) => {
      if (statusFilter !== 'all' && site.status !== statusFilter) return false;
      if (factoryFilter !== 'all' && site.factoryID !== factoryFilter) return false;

      if (!q) return true;
      const name = String(site.siteName ?? '').toLowerCase();
      const code = String(site.siteCode ?? '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [sites, searchQuery, factoryFilter, statusFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setFactoryFilter('all');
    setStatusFilter('all');
  };

  const openCreate = () => {
    setEditingSite(null);
    form.setFieldsValue({
      siteName: '',
      siteCode: '',
      factoryID: factories[0]?.factoryID || undefined!,
      status: 'Active',
    });
    setModalOpen(true);
  };

  const openEdit = (site: ApiSite) => {
    setEditingSite(site);
    form.setFieldsValue({
      siteName: site.siteName ?? '',
      siteCode: site.siteCode ?? '',
      factoryID: site.factoryID ?? undefined!,
      status: site.status ?? 'Active',
    });
    setModalOpen(true);
  };

  const saveSite = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        siteName: String(values.siteName ?? '').trim(),
        factoryID: values.factoryID,
        status: values.status,
      };

      if (editingSite) {
        await sitesApi.update(editingSite.siteID, payload);
        message.success('Đã cập nhật phân xưởng.');
      } else {
        await sitesApi.create(payload);
        message.success('Đã tạo phân xưởng mới.');
      }

      setModalOpen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Lỗi khi lưu phân xưởng.';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const removeSite = async (id: number) => {
    try {
      await sitesApi.remove(id);
      message.success('Đã xóa phân xưởng.');
      await loadData();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể xóa phân xưởng. Vui lòng kiểm tra các zone, buồng sấy và nhân sự liên kết.';
      message.error(msg);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'siteID', width: 80 },
    {
      title: 'Tên Phân xưởng',
      dataIndex: 'siteName',
      render: (v: string | null) => <Text strong>{v ?? '—'}</Text>,
      width: 200,
    },
    {
      title: 'Mã Phân xưởng',
      dataIndex: 'siteCode',
      render: (v: string | null) => <Tag color="blue">{v ?? '—'}</Tag>,
      width: 130,
    },
    {
      title: 'Nhà máy trực thuộc',
      dataIndex: ['factory', 'factoryName'],
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
      title: 'Số Zone',
      key: 'zonesCount',
      render: (_: unknown, r: ApiSite) => r._count?.zones ?? 0,
      width: 120,
    },
    {
      title: 'Số Buồng sấy',
      key: 'chambersCount',
      render: (_: unknown, r: ApiSite) => r._count?.devices ?? 0,
      width: 120,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 160,
      render: (_: unknown, site: ApiSite) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(site)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa phân xưởng này? Hành động này không thể hoàn tác."
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => void removeSite(site.siteID)}
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
            <BranchesOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Quản lý Phân xưởng
          </Title>
          <Text type="secondary">Cấu hình các phân xưởng, phân khu địa lý sản xuất trong nhà máy sấy.</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            Tải lại
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm Phân xưởng
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng số Phân xưởng" value={stats.total} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Đang hoạt động" value={stats.active} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng số Zone" value={stats.totalZones} />
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
              placeholder="Tìm tên hoặc mã phân xưởng..."
              allowClear
              style={{ width: 250 }}
            />
            <Select
              value={factoryFilter}
              onChange={(value) => setFactoryFilter(value)}
              style={{ width: 200 }}
              placeholder="Lọc theo nhà máy"
              options={[
                { value: 'all', label: 'Tất cả nhà máy' },
                ...factories.map(f => ({ value: f.factoryID, label: f.factoryName ?? `Factory ${f.factoryID}` })),
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
          <Text type="secondary">Hiển thị {filteredSites.length}/{sites.length} phân xưởng</Text>
        </Space>
        <Table
          dataSource={filteredSites}
          columns={columns}
          rowKey="siteID"
          pagination={{ defaultPageSize: 10, showSizeChanger: true }}
          locale={{ emptyText: <Empty description="Chưa có phân xưởng" /> }}
        />
      </Card>

      <Modal
        title={editingSite ? 'Sửa Phân xưởng' : 'Thêm Phân xưởng'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveSite()}
        confirmLoading={saving}
        okText={editingSite ? 'Lưu thay đổi' : 'Tạo mới'}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="siteName"
            label="Tên Phân xưởng"
            rules={[{ required: true, message: 'Vui lòng nhập tên phân xưởng.' }]}
          >
            <Input placeholder="Ví dụ: Phân xưởng sấy chính" />
          </Form.Item>
          {editingSite && (
            <Form.Item
              name="siteCode"
              label="Mã Phân xưởng (Tự động sinh)"
            >
              <Input disabled />
            </Form.Item>
          )}
          <Form.Item
            name="factoryID"
            label="Nhà máy trực thuộc"
            rules={[{ required: true, message: 'Vui lòng chọn nhà máy trực thuộc.' }]}
          >
            <Select
              placeholder="Chọn nhà máy"
              options={factories.map(f => ({ value: f.factoryID, label: f.factoryName ?? `Factory ${f.factoryID}` }))}
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
