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
  GlobalOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { zonesApi, ApiZone, chambersApi, ApiChamber } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function ZoneManagementPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<{ zoneName: string; zoneDescription?: string }>();
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [chambers, setChambers] = useState<ApiChamber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ApiZone | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'has-chamber' | 'empty'>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [zoneRows, chamberRows] = await Promise.all([
        zonesApi.getAll(),
        chambersApi.getAll(),
      ]);
      setZones(zoneRows);
      setChambers(chamberRows);
    } catch {
      message.error('Không thể tải danh sách zone.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const chamberMapByZone = useMemo(() => {
    const map = new Map<number, ApiChamber[]>();
    for (const chamber of chambers) {
      if (!chamber.zoneID) continue;
      if (!map.has(chamber.zoneID)) map.set(chamber.zoneID, []);
      map.get(chamber.zoneID)?.push(chamber);
    }
    return map;
  }, [chambers]);

  const stats = useMemo(() => {
    const activeZones = zones.filter((zone) => (chamberMapByZone.get(zone.zoneID)?.length ?? 0) > 0).length;
    return {
      zoneCount: zones.length,
      chamberCount: chambers.length,
      sensorCount: chambers.reduce((sum, chamber) => sum + (chamber.sensors?.length ?? 0), 0),
      activeZones,
    };
  }, [zones, chambers, chamberMapByZone]);

  const filteredZones = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return zones.filter((zone) => {
      const hasChamber = (chamberMapByZone.get(zone.zoneID)?.length ?? 0) > 0;
      if (occupancyFilter === 'has-chamber' && !hasChamber) return false;
      if (occupancyFilter === 'empty' && hasChamber) return false;

      if (!q) return true;
      const name = String(zone.zoneName ?? '').toLowerCase();
      const description = String(zone.zoneDescription ?? '').toLowerCase();
      return name.includes(q) || description.includes(q);
    });
  }, [chamberMapByZone, occupancyFilter, searchQuery, zones]);

  const resetFilters = () => {
    setSearchQuery('');
    setOccupancyFilter('all');
  };

  const openCreate = () => {
    setEditingZone(null);
    form.setFieldsValue({ zoneName: '', zoneDescription: '' });
    setModalOpen(true);
  };

  const openEdit = (zone: ApiZone) => {
    setEditingZone(zone);
    form.setFieldsValue({
      zoneName: zone.zoneName ?? '',
      zoneDescription: zone.zoneDescription ?? '',
    });
    setModalOpen(true);
  };

  const saveZone = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        zoneName: String(values.zoneName ?? '').trim(),
        zoneDescription: String(values.zoneDescription ?? '').trim() || undefined,
      };

      if (editingZone) {
        await zonesApi.update(editingZone.zoneID, payload);
        message.success('Đã cập nhật zone.');
      } else {
        await zonesApi.create(payload);
        message.success('Đã tạo zone mới.');
      }

      setModalOpen(false);
      await loadData();
    } catch {
      // validation/API errors are handled by form/message
    } finally {
      setSaving(false);
    }
  };

  const removeZone = async (id: number) => {
    try {
      await zonesApi.remove(id);
      message.success('Đã xóa zone.');
      await loadData();
    } catch {
      message.error('Không thể xóa zone. Nếu zone còn buồng sấy, hãy chuyển/xóa buồng trước.');
    }
  };

  const columns = [
    { title: 'Mã Zone', dataIndex: 'zoneID', width: 100 },
    {
      title: 'Tên Zone',
      dataIndex: 'zoneName',
      render: (v: string | null) => <Text strong>{v ?? '—'}</Text>,
      width: 180,
    },
    { title: 'Mô tả', dataIndex: 'zoneDescription' },
    {
      title: 'Buồng sấy trong Zone',
      key: 'chambers',
      render: (_: unknown, r: ApiZone) => {
        const rows = chamberMapByZone.get(r.zoneID) ?? [];
        if (rows.length === 0) return <Text type="secondary">Chưa có buồng sấy</Text>;

        return (
          <Space size={[6, 6]} wrap>
            {rows.map((chamber) => (
              <Tag key={chamber.chamberID} color="blue">
                {chamber.chamberName ?? `Buồng ${chamber.chamberID}`}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 140,
      render: (_: unknown, zone: ApiZone) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(zone)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa zone này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => void removeZone(zone.zoneID)}
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
            <GlobalOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Quản lý Zone
          </Title>
          <Text type="secondary">Mỗi Zone gồm nhiều Buồng sấy (A/B/C...).</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            Tải lại
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm Zone
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng Zone" value={stats.zoneCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Zone có buồng" value={stats.activeZones} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng Buồng sấy" value={stats.chamberCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Tổng cảm biến" value={stats.sensorCount} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
          <Space wrap>
            <Input.Search
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm tên/mô tả zone..."
              allowClear
              style={{ width: 300 }}
            />
            <Select
              value={occupancyFilter}
              onChange={(value) => setOccupancyFilter(value)}
              style={{ width: 220 }}
              options={[
                { value: 'all', label: 'Tất cả zone' },
                { value: 'has-chamber', label: 'Zone có buồng sấy' },
                { value: 'empty', label: 'Zone chưa có buồng' },
              ]}
            />
            <Button onClick={resetFilters}>Xóa lọc</Button>
          </Space>
          <Text type="secondary">Hiển thị {filteredZones.length}/{zones.length} zone</Text>
        </Space>
        <Table
          dataSource={filteredZones}
          columns={columns}
          rowKey="zoneID"
          pagination={false}
          locale={{ emptyText: <Empty description="Chưa có zone" /> }}
        />
      </Card>

      <Modal
        title={editingZone ? 'Sửa Zone' : 'Thêm Zone'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveZone()}
        confirmLoading={saving}
        okText={editingZone ? 'Lưu thay đổi' : 'Tạo Zone'}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="zoneName"
            label="Tên Zone"
            rules={[{ required: true, message: 'Vui lòng nhập tên zone.' }]}
          >
            <Input placeholder="Ví dụ: Zone A" />
          </Form.Item>
          <Form.Item name="zoneDescription" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Zone A gồm các buồng sấy A/B/C" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
