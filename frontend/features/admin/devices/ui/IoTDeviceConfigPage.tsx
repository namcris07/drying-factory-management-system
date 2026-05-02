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
  InputNumber,
} from 'antd';
import { ApiOutlined, PlusOutlined, EditOutlined, SyncOutlined, MinusCircleOutlined } from '@ant-design/icons';
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

  const normalizeFeedKey = (feedKey: string) => String(feedKey ?? '').trim().toLowerCase();

  const parseLegacyFeeds = (raw: string | null | undefined) =>
    String(raw ?? '')
      .split(/[\n,;]/)
      .map((item) => normalizeFeedKey(item))
      .filter(Boolean);

  const buildSensorRows = (device: ApiDevice) => {
    if (Array.isArray(device.sensorChannels) && device.sensorChannels.length > 0) {
      return device.sensorChannels.map((channel, index) => ({
        sensorName: channel.sensorName ?? '',
        sensorType: channel.sensorType ?? 'Custom',
        feedKey: channel.feedKey ?? '',
        status: channel.status ?? 'Active',
        unit: channel.unit ?? '',
        sortOrder: channel.sortOrder ?? index + 1,
      }));
    }

    const feeds = parseLegacyFeeds(device.mqttTopicSensor);
    return feeds.length > 0
      ? feeds.map((feedKey, index) => ({
          sensorName: `Sensor ${index + 1}`,
          sensorType: device.deviceType ?? 'Custom',
          feedKey,
          status: 'Active',
          unit: '',
          sortOrder: index + 1,
        }))
      : [
          {
            sensorName: 'Sensor 1',
            sensorType: device.deviceType ?? 'Custom',
            feedKey: '',
            status: 'Active',
            unit: '',
            sortOrder: 1,
          },
        ];
  };

  const buildActuatorRows = (device: ApiDevice) => {
    if (Array.isArray(device.actuatorChannels) && device.actuatorChannels.length > 0) {
      return device.actuatorChannels.map((channel, index) => ({
        actuatorName: channel.actuatorName ?? '',
        actuatorType: channel.actuatorType ?? 'Custom',
        feedKey: channel.feedKey ?? '',
        status: channel.status ?? 'Active',
        controlMode: channel.controlMode ?? '',
        onValue: channel.onValue ?? '',
        offValue: channel.offValue ?? '',
        sortOrder: channel.sortOrder ?? index + 1,
      }));
    }

    const feeds = parseLegacyFeeds(device.mqttTopicCmd);
    return feeds.length > 0
      ? feeds.map((feedKey, index) => ({
          actuatorName: `Actuator ${index + 1}`,
          actuatorType: device.deviceType ?? 'Custom',
          feedKey,
          status: 'Active',
          controlMode: '',
          onValue: '',
          offValue: '',
          sortOrder: index + 1,
        }))
      : [
          {
            actuatorName: 'Actuator 1',
            actuatorType: device.deviceType ?? 'Custom',
            feedKey: '',
            status: 'Active',
            controlMode: '',
            onValue: '',
            offValue: '',
            sortOrder: 1,
          },
        ];
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
      deviceType: 'DryingChamber',
      deviceStatus: 'Active',
      zoneID: undefined,
      organizationID: undefined,
      factoryID: undefined,
      siteID: undefined,
      sensorChannels: [
        {
          sensorName: 'Cảm biến nhiệt độ 1',
          sensorType: 'TemperatureSensor',
          feedKey: '',
          status: 'Active',
          unit: '°C',
          sortOrder: 1,
        },
      ],
      actuatorChannels: [
        {
          actuatorName: 'Quạt 1',
          actuatorType: 'Fan',
          feedKey: '',
          status: 'Active',
          controlMode: '',
          onValue: '',
          offValue: '',
          sortOrder: 1,
        },
      ],
    });
    setOpenModal(true);
  };

  const openEdit = (device: ApiDevice) => {
    setEditingDevice(device);
    form.setFieldsValue({
      deviceName: device.deviceName ?? '',
      deviceType: device.deviceType ?? 'TemperatureSensor',
      deviceStatus: device.deviceStatus ?? 'Active',
      zoneID: device.zoneID ?? undefined,
      organizationID: device.organizationID ?? undefined,
      factoryID: device.factoryID ?? undefined,
      siteID: device.siteID ?? undefined,
      sensorChannels: buildSensorRows(device),
      actuatorChannels: buildActuatorRows(device),
    });
    setOpenModal(true);
  };

  const saveDevice = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const sensorChannels = Array.isArray(values.sensorChannels)
        ? values.sensorChannels
            .map((channel: Record<string, unknown>, index: number) => ({
              sensorName: String(channel.sensorName ?? '').trim() || `Sensor ${index + 1}`,
              sensorType: String(channel.sensorType ?? '').trim() || 'Custom',
              feedKey: normalizeFeedKey(String(channel.feedKey ?? '')),
              status: String(channel.status ?? '').trim() || 'Active',
              unit: String(channel.unit ?? '').trim() || undefined,
              sortOrder: Number(channel.sortOrder ?? index + 1),
            }))
            .filter((channel: { feedKey: string }) => Boolean(channel.feedKey))
        : [];

      const actuatorChannels = Array.isArray(values.actuatorChannels)
        ? values.actuatorChannels
            .map((channel: Record<string, unknown>, index: number) => ({
              actuatorName: String(channel.actuatorName ?? '').trim() || `Actuator ${index + 1}`,
              actuatorType: String(channel.actuatorType ?? '').trim() || 'Custom',
              feedKey: normalizeFeedKey(String(channel.feedKey ?? '')),
              status: String(channel.status ?? '').trim() || 'Active',
              controlMode: String(channel.controlMode ?? '').trim() || undefined,
              onValue: String(channel.onValue ?? '').trim() || undefined,
              offValue: String(channel.offValue ?? '').trim() || undefined,
              sortOrder: Number(channel.sortOrder ?? index + 1),
            }))
            .filter((channel: { feedKey: string }) => Boolean(channel.feedKey))
        : [];

      if (sensorChannels.length === 0 && actuatorChannels.length === 0) {
        message.warning('Thiết bị phải có ít nhất một sensor hoặc actuator channel.');
        return;
      }

      const payload = {
        deviceName: String(values.deviceName ?? '').trim(),
        deviceType: String(values.deviceType ?? '').trim() || undefined,
        deviceStatus: String(values.deviceStatus ?? '').trim() || undefined,
        zoneID: values.zoneID,
        organizationID: values.organizationID,
        factoryID: values.factoryID,
        siteID: values.siteID,
        mqttTopicSensor: sensorChannels.map((channel: { feedKey: string }) => channel.feedKey).join(','),
        mqttTopicCmd: actuatorChannels.map((channel: { feedKey: string }) => channel.feedKey).join(','),
        sensorChannels,
        actuatorChannels,
        metaData: {
          feedKey: sensorChannels[0]?.feedKey ?? actuatorChannels[0]?.feedKey ?? '',
          sensorChannels,
          actuatorChannels,
        },
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
      title: 'Sensor channels',
      dataIndex: 'sensorChannels',
      render: (_: string, r: ApiDevice) => {
        const feeds = (Array.isArray(r.sensorChannels) && r.sensorChannels.length > 0)
          ? r.sensorChannels.map((channel) => channel.feedKey)
          : parseLegacyFeeds(r.mqttTopicSensor);
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
      title: 'Actuator channels',
      dataIndex: 'actuatorChannels',
      render: (_: string, r: ApiDevice) => {
        const feeds = (Array.isArray(r.actuatorChannels) && r.actuatorChannels.length > 0)
          ? r.actuatorChannels.map((channel) => channel.feedKey)
          : parseLegacyFeeds(r.mqttTopicCmd);
        if (feeds.length === 0) return '—';
        return (
          <Space size={[4, 4]} wrap>
            {feeds.map((feed) => (
              <Tag key={`${r.deviceID}-${feed}`} color="gold">{feed}</Tag>
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
            <Form.Item label="Loại thiết bị" name="deviceType" style={{ width: 200 }}>
              <Select
                showSearch
                allowClear
                placeholder="Chọn hoặc nhập loại thiết bị"
                options={[
                  { value: 'DryingChamber', label: 'Buồng sấy (DryingChamber)' },
                  { value: 'TemperatureSensor', label: 'Cảm biến nhiệt độ' },
                  { value: 'HumiditySensor', label: 'Cảm biến độ ẩm' },
                  { value: 'LightSensor', label: 'Cảm biến ánh sáng' },
                  { value: 'Fan', label: 'Quạt (Fan)' },
                  { value: 'Heater', label: 'Máy gia nhiệt (Heater)' },
                  { value: 'Pump', label: 'Máy bơm (Pump)' },
                  { value: 'Led', label: 'Đèn LED' },
                  { value: 'Lcd', label: 'Màn hình LCD' },
                  { value: 'Custom', label: 'Tùy chỉnh (Custom)' },
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

          <Space style={{ width: '100%', marginBottom: 12 }} size={12}>
            <Form.Item label="Organization ID" name="organizationID" style={{ width: 120 }}>
              <InputNumber style={{ width: '100%' }} min={1} placeholder="Org" />
            </Form.Item>
            <Form.Item label="Factory ID" name="factoryID" style={{ width: 120 }}>
              <InputNumber style={{ width: '100%' }} min={1} placeholder="Factory" />
            </Form.Item>
            <Form.Item label="Site ID" name="siteID" style={{ width: 120 }}>
              <InputNumber style={{ width: '100%' }} min={1} placeholder="Site" />
            </Form.Item>
          </Space>

          <Card size="small" title="Sensor channels" style={{ marginBottom: 12 }}>
            <Form.List name="sensorChannels">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item name={[field.name, 'sensorName']} rules={[{ required: true, message: 'Nhập tên sensor.' }]} style={{ width: 120 }}>
                        <Input placeholder="Tên" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'sensorType']} rules={[{ required: true, message: 'Nhập loại sensor.' }]} style={{ width: 160 }}>
                        <Select
                          showSearch
                          allowClear
                          placeholder="Loại cảm biến"
                          options={[
                            { value: 'TemperatureSensor', label: 'Nhiệt độ (TemperatureSensor)' },
                            { value: 'HumiditySensor', label: 'Độ ẩm (HumiditySensor)' },
                            { value: 'LightSensor', label: 'Ánh sáng (LightSensor)' },
                            { value: 'Custom', label: 'Tùy chỉnh (Custom)' },
                          ]} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'feedKey']} rules={[{ required: true, message: 'Nhập feed key.' }]} style={{ width: 180 }}>
                        <Input placeholder="drytech.m-a1-temp-in" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'status']} style={{ width: 110 }}>
                        <Select options={[
                          { value: 'Active', label: 'Active' },
                          { value: 'Inactive', label: 'Inactive' },
                          { value: 'Maintenance', label: 'Maintenance' },
                        ]} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'unit']} style={{ width: 100 }}>
                        <Input placeholder="°C" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'sortOrder']} style={{ width: 80 }}>
                        <InputNumber style={{ width: '100%' }} min={1} />
                      </Form.Item>
                      <Button icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ sensorName: '', sensorType: 'Custom', feedKey: '', status: 'Active', unit: '', sortOrder: fields.length + 1 })} block icon={<PlusOutlined />}>
                    Thêm sensor channel
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Card size="small" title="Actuator channels">
            <Form.List name="actuatorChannels">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item name={[field.name, 'actuatorName']} rules={[{ required: true, message: 'Nhập tên actuator.' }]} style={{ width: 120 }}>
                        <Input placeholder="Tên" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'actuatorType']} rules={[{ required: true, message: 'Nhập loại actuator.' }]} style={{ width: 160 }}>
                        <Select
                          showSearch
                          allowClear
                          placeholder="Loại chấp hành"
                          options={[
                            { value: 'Fan', label: 'Quạt (Fan)' },
                            { value: 'Heater', label: 'Máy gia nhiệt (Heater)' },
                            { value: 'Pump', label: 'Máy bơm (Pump)' },
                            { value: 'Led', label: 'Đèn LED (Led)' },
                            { value: 'Lcd', label: 'Màn hình LCD (Lcd)' },
                            { value: 'Custom', label: 'Tùy chỉnh (Custom)' },
                          ]} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'feedKey']} rules={[{ required: true, message: 'Nhập feed key.' }]} style={{ width: 180 }}>
                        <Input placeholder="drytech.m-a1-fan-1" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'status']} style={{ width: 110 }}>
                        <Select options={[
                          { value: 'Active', label: 'Active' },
                          { value: 'Inactive', label: 'Inactive' },
                          { value: 'Maintenance', label: 'Maintenance' },
                        ]} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'controlMode']} style={{ width: 110 }}>
                        <Input placeholder="mode" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'onValue']} style={{ width: 100 }}>
                        <Input placeholder="on" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'offValue']} style={{ width: 100 }}>
                        <Input placeholder="off" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'sortOrder']} style={{ width: 80 }}>
                        <InputNumber style={{ width: '100%' }} min={1} />
                      </Form.Item>
                      <Button icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ actuatorName: '', actuatorType: 'Custom', feedKey: '', status: 'Active', controlMode: '', onValue: '', offValue: '', sortOrder: fields.length + 1 })} block icon={<PlusOutlined />}>
                    Thêm actuator channel
                  </Button>
                </>
              )}
            </Form.List>
          </Card>
        </Form>
      </Modal>
    </div>
  );
}
