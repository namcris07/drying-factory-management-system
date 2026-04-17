"use client";

/**
 * app/(admin)/admin/devices/page.tsx
 * Cấu hình Thiết bị IoT — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Badge,
  Spin,
  App,
  Modal,
  Form,
  Input,
  Select,
} from 'antd';
import { ApiOutlined, PlusOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons';
import { devicesApi, ApiDevice, zonesApi, ApiZone } from '@/shared/lib/api';

const { Title, Text } = Typography;

export default function IoTDeviceConfigPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [devices, setDevices] = useState<ApiDevice[]>([]);
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<ApiDevice | null>(null);

  const parseSensorFeeds = (device: ApiDevice) => {
    const fromText = String(device.mqttTopicSensor ?? '')
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return fromText.length > 0 ? [fromText[0]] : [];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [deviceRows, zoneRows] = await Promise.all([
        devicesApi.getAll(),
        zonesApi.getAll(),
      ]);
      setDevices(deviceRows);
      setZones(zoneRows);
    } catch {
      message.error('Không thể tải dữ liệu thiết bị.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditingDevice(null);
    form.setFieldsValue({
      deviceName: '',
      deviceType: 'TemperatureSensor',
      deviceStatus: 'Active',
      mqttTopicSensor: '',
      zoneID: undefined,
    });
    setOpenModal(true);
  };

  const openEdit = (device: ApiDevice) => {
    setEditingDevice(device);
    form.setFieldsValue({
      deviceName: device.deviceName ?? '',
      deviceType: device.deviceType ?? 'TemperatureSensor',
      deviceStatus: device.deviceStatus ?? 'Active',
      mqttTopicSensor: parseSensorFeeds(device)[0] ?? '',
      zoneID: device.zoneID ?? undefined,
    });
    setOpenModal(true);
  };

  const saveDevice = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const feedCandidates = String(values.mqttTopicSensor ?? '')
        .split(/[\n,;]/)
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);

      if (feedCandidates.length !== 1) {
        message.warning('Thiết bị phải có đúng 1 feed key.');
        return;
      }

      const mqttTopicSensor = feedCandidates[0];

      const payload = {
        deviceName: String(values.deviceName ?? '').trim(),
        deviceType: String(values.deviceType ?? '').trim() || undefined,
        deviceStatus: String(values.deviceStatus ?? '').trim() || undefined,
        zoneID: values.zoneID,
        mqttTopicSensor,
        metaData: { feedKey: mqttTopicSensor },
      };

      if (editingDevice) {
        await devicesApi.update(editingDevice.deviceID, payload);
        message.success('Đã cập nhật thiết bị.');
      } else {
        await devicesApi.create(payload);
        message.success('Đã tạo thiết bị mới.');
      }

      setOpenModal(false);
      await loadData();
    } catch {
      // Validation/API errors are surfaced via form/message.
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'deviceID', width: 80 },
    { title: 'Tên', dataIndex: 'deviceName', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Loại', dataIndex: 'deviceType', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Zone',
      key: 'zone',
      render: (_: unknown, r: ApiDevice) => r.zone?.zoneName ?? '—',
    },
    {
      title: 'Kết nối',
      dataIndex: 'deviceStatus',
      render: (v: string) => (
        <Badge
          status={v === 'Active' ? 'success' : 'error'}
          text={v === 'Active' ? 'Online' : 'Offline'}
        />
      ),
    },
    {
      title: 'MQTT Sensor Topic',
      dataIndex: 'mqttTopicSensor',
      render: (_: string, r: ApiDevice) => {
        const feeds = parseSensorFeeds(r);
        if (feeds.length === 0) return '—';
        return (
          <Space size={[4, 4]} wrap>
            {feeds.map((feed) => (
              <Tag key={`${r.deviceID}-${feed}`} color="blue">{feed}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: unknown, record: ApiDevice) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Sửa
          </Button>
          <Button size="small" icon={<SyncOutlined />} onClick={() => void loadData()}>
            Tải lại
          </Button>
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
            <ApiOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Cấu hình Thiết bị IoT
          </Title>
          <Text type="secondary">Quản lý sensors, actuators và các thiết bị kết nối</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Thêm thiết bị
        </Button>
      </div>

      {/* Stats */}
      <Space style={{ marginBottom: 24 }}>
        <Tag color="success" style={{ padding: '8px 16px', fontSize: 14 }}>
          🟢 Online: {devices.filter(d => d.deviceStatus === 'Active').length}
        </Tag>
        <Tag color="error" style={{ padding: '8px 16px', fontSize: 14 }}>
          🔴 Offline: {devices.filter(d => d.deviceStatus !== 'Active').length}
        </Tag>
        <Tag style={{ padding: '8px 16px', fontSize: 14 }}>
          📡 Tổng: {devices.length}
        </Tag>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={devices}
          columns={columns}
          rowKey="deviceID"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingDevice ? 'Cập nhật thiết bị' : 'Thêm thiết bị mới'}
        open={openModal}
        onCancel={() => setOpenModal(false)}
        onOk={() => void saveDevice()}
        okText={editingDevice ? 'Lưu thay đổi' : 'Tạo thiết bị'}
        cancelText="Hủy"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Tên thiết bị"
            name="deviceName"
            rules={[{ required: true, message: 'Vui lòng nhập tên thiết bị.' }]}
          >
            <Input placeholder="Ví dụ: Máy sấy A2" />
          </Form.Item>

          <Space style={{ width: '100%' }} size={12}>
            <Form.Item label="Loại thiết bị" name="deviceType" style={{ width: 150 }}>
              <Select
                options={[
                      { value: 'TemperatureSensor', label: 'TemperatureSensor' },
                      { value: 'HumiditySensor', label: 'HumiditySensor' },
                      { value: 'Fan', label: 'Fan' },
                      { value: 'Led', label: 'Led' },
                      { value: 'Lcd', label: 'Lcd' },
                ]}
              />
            </Form.Item>

            <Form.Item label="Trạng thái" name="deviceStatus" style={{ width: 150 }}>
              <Select
                options={[
                  { value: 'Active', label: 'Active' },
                  { value: 'Inactive', label: 'Inactive' },
                  { value: 'Maintenance', label: 'Maintenance' },
                ]}
              />
            </Form.Item>

            <Form.Item label="Zone" name="zoneID" style={{ width: 100 }}>
              <Select
                allowClear
                placeholder="Chọn zone"
                options={zones.map((z) => ({
                  value: z.zoneID,
                  label: z.zoneName ?? `Zone ${z.zoneID}`,
                }))}
              />
            </Form.Item>
          </Space>

          <Form.Item
            label="MQTT feed key"
            name="mqttTopicSensor"
            extra="Chỉ nhập một feed key duy nhất cho thiết bị."
          >
            <Input placeholder="Ví dụ: drytech.m-a1-temp-1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
