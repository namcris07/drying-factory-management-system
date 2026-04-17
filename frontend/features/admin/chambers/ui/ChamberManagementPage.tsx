"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ApartmentOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { ApiChamber, ApiZone, chambersApi, zonesApi } from '@/shared/lib/api';

const { Title, Text } = Typography;

type SensorFormValue = {
  sensorName?: string;
  sensorType: string;
  feedKey: string;
  status?: string;
};

type ChamberFormValues = {
  chamberName: string;
  chamberDescription?: string;
  zoneID: number;
  chamberStatus?: string;
  sensors?: SensorFormValue[];
};

const SENSOR_TYPE_OPTIONS = [
  { value: 'TemperatureSensor', label: 'TemperatureSensor' },
  { value: 'HumiditySensor', label: 'HumiditySensor' },
  { value: 'LightSensor', label: 'LightSensor' },
  { value: 'Fan', label: 'Fan' },
  { value: 'Lcd', label: 'Lcd' },
  { value: 'Custom', label: 'Custom' },
];

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Maintenance', label: 'Maintenance' },
];

function normalizeFeedKey(raw: string): string {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text) return '';
  const marker = '/feeds/';
  const markerIndex = text.indexOf(marker);
  if (markerIndex >= 0) {
    return text.slice(markerIndex + marker.length).trim();
  }
  return text;
}

function statusBadge(status: string | null | undefined) {
  const value = String(status ?? '').toLowerCase();
  if (value === 'active') return { color: 'green' as const, text: 'Active' };
  if (value === 'maintenance') {
    return { color: 'gold' as const, text: 'Maintenance' };
  }
  return { color: 'red' as const, text: 'Inactive' };
}

export default function ChamberManagementPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<ChamberFormValues>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [chambers, setChambers] = useState<ApiChamber[]>([]);
  const [editing, setEditing] = useState<ApiChamber | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'maintenance'>('all');
  const [zoneFilter, setZoneFilter] = useState<number | 'all'>('all');

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
      message.error('Không thể tải dữ liệu zone và buồng sấy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const sensorCount = chambers.reduce(
      (sum, chamber) => sum + (chamber.sensors?.length ?? 0),
      0,
    );
    const activeCount = chambers.filter(
      (item) => String(item.chamberStatus ?? '').toLowerCase() === 'active',
    ).length;

    return {
      zoneCount: zones.length,
      chamberCount: chambers.length,
      sensorCount,
      activeCount,
    };
  }, [chambers, zones.length]);

  const filteredChambers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return chambers.filter((chamber) => {
      if (zoneFilter !== 'all' && chamber.zoneID !== zoneFilter) {
        return false;
      }

      const status = String(chamber.chamberStatus ?? '').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (!q) return true;
      const name = String(chamber.chamberName ?? '').toLowerCase();
      const description = String(chamber.chamberDescription ?? '').toLowerCase();
      const zoneName = String(chamber.zoneName ?? '').toLowerCase();
      const sensors = (chamber.sensors ?? [])
        .map((sensor) => `${sensor.sensorName} ${sensor.sensorType} ${sensor.feedKey}`.toLowerCase())
        .join(' ');

      return (
        name.includes(q) ||
        description.includes(q) ||
        zoneName.includes(q) ||
        sensors.includes(q)
      );
    });
  }, [chambers, searchQuery, statusFilter, zoneFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setZoneFilter('all');
  };

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      chamberName: '',
      chamberDescription: '',
      zoneID: zones[0]?.zoneID,
      chamberStatus: 'Active',
      sensors: [],
    });
    setModalOpen(true);
  };

  const openEdit = (row: ApiChamber) => {
    setEditing(row);
    form.setFieldsValue({
      chamberName: row.chamberName ?? '',
      chamberDescription: row.chamberDescription ?? '',
      zoneID: row.zoneID ?? zones[0]?.zoneID,
      chamberStatus: row.chamberStatus ?? 'Active',
      sensors: (row.sensors ?? []).map((sensor) => ({
        sensorName: sensor.sensorName,
        sensorType: sensor.sensorType,
        feedKey: sensor.feedKey,
        status: sensor.status,
      })),
    });
    setModalOpen(true);
  };

  const saveChamber = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const sensors = (values.sensors ?? [])
        .map((sensor) => ({
          sensorName: String(sensor.sensorName ?? '').trim() || undefined,
          sensorType: String(sensor.sensorType ?? '').trim(),
          feedKey: normalizeFeedKey(sensor.feedKey),
          status: String(sensor.status ?? 'Active').trim() || 'Active',
        }))
        .filter((sensor) => sensor.feedKey);

      const payload = {
        chamberName: String(values.chamberName ?? '').trim(),
        chamberDescription:
          String(values.chamberDescription ?? '').trim() || undefined,
        zoneID: Number(values.zoneID),
        chamberStatus: String(values.chamberStatus ?? 'Active'),
        sensors,
      };

      if (editing) {
        await chambersApi.update(editing.chamberID, payload);
        message.success('Đã cập nhật buồng sấy.');
      } else {
        await chambersApi.create(payload);
        message.success('Đã tạo buồng sấy.');
      }

      setModalOpen(false);
      await loadData();
    } catch {
      // Form/API errors are shown by AntD/message.
    } finally {
      setSaving(false);
    }
  };

  const removeChamber = async (id: number) => {
    try {
      await chambersApi.remove(id);
      message.success('Đã xóa buồng sấy.');
      await loadData();
    } catch {
      message.error('Không thể xóa buồng sấy.');
    }
  };

  const columns = [
    {
      title: 'Buồng sấy',
      key: 'name',
      render: (_: unknown, row: ApiChamber) => (
        <div>
          <Text strong>{row.chamberName ?? `Buồng ${row.chamberID}`}</Text>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>#{row.chamberID}</div>
        </div>
      ),
    },
    {
      title: 'Zone',
      key: 'zone',
      render: (_: unknown, row: ApiChamber) => row.zoneName ?? '—',
      width: 180,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 150,
      render: (_: unknown, row: ApiChamber) => {
        const mapped = statusBadge(row.chamberStatus);
        return <Badge color={mapped.color} text={mapped.text} />;
      },
    },
    {
      title: 'Số cảm biến',
      key: 'sensorCount',
      width: 130,
      render: (_: unknown, row: ApiChamber) => (
        <Tag color="blue">{row.sensors?.length ?? 0}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: unknown, row: ApiChamber) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa buồng sấy này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => void removeChamber(row.chamberID)}
          >
            <Button size="small" danger>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ApartmentOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Quản lý Buồng sấy
          </Title>
          <Text type="secondary">
            Buồng sấy là thiết bị sấy lớn; cảm biến được gắn trực tiếp vào từng buồng.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()}>
            Tải lại
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm buồng sấy
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Zone" value={stats.zoneCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Buồng sấy" value={stats.chamberCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Cảm biến" value={stats.sensorCount} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Buồng Active" value={stats.activeCount} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
          <Space wrap>
            <Input.Search
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm buồng/zone/feed cảm biến..."
              allowClear
              style={{ width: 300 }}
            />
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'maintenance', label: 'Maintenance' },
              ]}
            />
            <Select
              value={zoneFilter}
              onChange={(value) => setZoneFilter(value)}
              style={{ width: 180 }}
              options={[
                { value: 'all', label: 'Tất cả zone' },
                ...zones.map((zone) => ({
                  value: zone.zoneID,
                  label: zone.zoneName ?? `Zone ${zone.zoneID}`,
                })),
              ]}
            />
            <Button onClick={resetFilters}>Xóa lọc</Button>
          </Space>
          <Text type="secondary">Hiển thị {filteredChambers.length}/{chambers.length} buồng</Text>
        </Space>
        <Table
          rowKey="chamberID"
          dataSource={filteredChambers}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="Chưa có buồng sấy" /> }}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa buồng sấy' : 'Thêm buồng sấy'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveChamber()}
        confirmLoading={saving}
        width={980}
        styles={{
          body: {
            maxHeight: '70vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: 8,
          },
        }}
        okText={editing ? 'Lưu thay đổi' : 'Tạo buồng'}
      >

        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Tên buồng sấy"
                name="chamberName"
                rules={[{ required: true, message: 'Vui lòng nhập tên buồng sấy.' }]}
              >
                <Input placeholder="Ví dụ: Buồng sấy A1" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item
                label="Zone"
                name="zoneID"
                rules={[{ required: true, message: 'Vui lòng chọn zone.' }]}
              >
                <Select
                  options={zones.map((zone) => ({
                    value: zone.zoneID,
                    label: zone.zoneName ?? `Zone ${zone.zoneID}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item label="Trạng thái" name="chamberStatus">
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Mô tả" name="chamberDescription">
            <Input.TextArea rows={3} placeholder="Mô tả buồng sấy" />
          </Form.Item>

          <div style={{ marginBottom: 8, fontWeight: 600 }}>Cảm biến gắn với buồng</div>

          <Form.List name="sensors">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Row gutter={8} key={field.key} align="top" style={{ marginBottom: 8 }}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        {...field}
                        label="Tên cảm biến"
                        name={[field.name, 'sensorName']}
                      >
                        <Input placeholder="Sensor nhiệt độ" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={5}>
                      <Form.Item
                        {...field}
                        label="Loại"
                        name={[field.name, 'sensorType']}
                        rules={[{ required: true, message: 'Chọn loại.' }]}
                      >
                        <Select options={SENSOR_TYPE_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        {...field}
                        label="Feed key"
                        name={[field.name, 'feedKey']}
                        rules={[{ required: true, message: 'Nhập feed key.' }]}
                      >
                        <Input placeholder="drytech.m-a1-temp-1" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={3}>
                      <Form.Item
                        {...field}
                        label="Status"
                        name={[field.name, 'status']}
                      >
                        <Select options={STATUS_OPTIONS} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={2}>
                      <Button danger style={{ marginTop: 30 }} onClick={() => remove(field.name)}>
                        Xóa
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add({ sensorType: 'TemperatureSensor', status: 'Active' })}>
                  + Thêm cảm biến
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
