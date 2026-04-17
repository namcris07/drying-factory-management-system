"use client";

import { useMemo, useState } from 'react';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ApartmentOutlined,
  DashboardOutlined,
  PlusOutlined,
  RadarChartOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

type SensorType = 'temperature' | 'humidity' | 'light' | 'co2' | 'custom';
type ActuatorType = 'fan' | 'heater' | 'damper' | 'dehumidifier' | 'light';
type DeviceStatus = 'online' | 'offline' | 'maintenance';

type SensorNode = {
  id: string;
  code: string;
  name: string;
  sensorType: SensorType;
  value: number;
  unit: string;
  feed: string;
  status: DeviceStatus;
};

type ActuatorNode = {
  id: string;
  code: string;
  name: string;
  actuatorType: ActuatorType;
  level: number;
  feed: string;
  status: DeviceStatus;
};

type ChamberModel = {
  id: string;
  chamberCode: string;
  chamberName: string;
  zoneName: string;
  mode: 'auto' | 'manual';
  batchStatus: 'idle' | 'running' | 'warning';
  sensors: SensorNode[];
  actuators: ActuatorNode[];
};

const chamberSeeds: ChamberModel[] = [
  {
    id: 'ch-a1',
    chamberCode: 'M-A1',
    chamberName: 'Buong say A1',
    zoneName: 'Zone A',
    mode: 'auto',
    batchStatus: 'running',
    sensors: [
      {
        id: 'sen-a1-temp-1',
        code: 'SEN-A1-T1',
        name: 'Nhiet do cua vao',
        sensorType: 'temperature',
        value: 62.3,
        unit: '°C',
        feed: 'drytech.m-a1-temp-in',
        status: 'online',
      },
      {
        id: 'sen-a1-temp-2',
        code: 'SEN-A1-T2',
        name: 'Nhiet do cua ra',
        sensorType: 'temperature',
        value: 59.8,
        unit: '°C',
        feed: 'drytech.m-a1-temp-out',
        status: 'online',
      },
      {
        id: 'sen-a1-hum-1',
        code: 'SEN-A1-H1',
        name: 'Do am trung tam',
        sensorType: 'humidity',
        value: 43,
        unit: '%',
        feed: 'drytech.m-a1-humidity-core',
        status: 'online',
      },
    ],
    actuators: [
      {
        id: 'act-a1-fan-1',
        code: 'ACT-A1-F1',
        name: 'Quat cap gio 1',
        actuatorType: 'fan',
        level: 72,
        feed: 'drytech.m-a1-fan-1',
        status: 'online',
      },
      {
        id: 'act-a1-heat-1',
        code: 'ACT-A1-HT1',
        name: 'Cum gia nhiet 1',
        actuatorType: 'heater',
        level: 58,
        feed: 'drytech.m-a1-heater-1',
        status: 'online',
      },
    ],
  },
  {
    id: 'ch-a2',
    chamberCode: 'M-A2',
    chamberName: 'Buong say A2',
    zoneName: 'Zone A',
    mode: 'manual',
    batchStatus: 'warning',
    sensors: [
      {
        id: 'sen-a2-temp-1',
        code: 'SEN-A2-T1',
        name: 'Nhiet do trung tam',
        sensorType: 'temperature',
        value: 67.4,
        unit: '°C',
        feed: 'drytech.m-a2-temp-core',
        status: 'online',
      },
      {
        id: 'sen-a2-co2-1',
        code: 'SEN-A2-C1',
        name: 'Cam bien CO2',
        sensorType: 'co2',
        value: 1320,
        unit: 'ppm',
        feed: 'drytech.m-a2-co2',
        status: 'maintenance',
      },
    ],
    actuators: [
      {
        id: 'act-a2-fan-1',
        code: 'ACT-A2-F1',
        name: 'Quat cap gio 1',
        actuatorType: 'fan',
        level: 45,
        feed: 'drytech.m-a2-fan-1',
        status: 'online',
      },
      {
        id: 'act-a2-fan-2',
        code: 'ACT-A2-F2',
        name: 'Quat cap gio 2',
        actuatorType: 'fan',
        level: 40,
        feed: 'drytech.m-a2-fan-2',
        status: 'offline',
      },
    ],
  },
  {
    id: 'ch-b1',
    chamberCode: 'M-B1',
    chamberName: 'Buong say B1',
    zoneName: 'Zone B',
    mode: 'auto',
    batchStatus: 'idle',
    sensors: [],
    actuators: [],
  },
];

function statusToBadge(status: DeviceStatus) {
  if (status === 'online') return { text: 'Online', color: 'green' as const };
  if (status === 'maintenance') {
    return { text: 'Maintenance', color: 'gold' as const };
  }
  return { text: 'Offline', color: 'red' as const };
}

function sensorTypeTag(type: SensorType) {
  const label: Record<SensorType, string> = {
    temperature: 'Temperature',
    humidity: 'Humidity',
    light: 'Light',
    co2: 'CO2',
    custom: 'Custom',
  };
  return <Tag color="blue">{label[type]}</Tag>;
}

function actuatorTypeTag(type: ActuatorType) {
  const label: Record<ActuatorType, string> = {
    fan: 'Fan',
    heater: 'Heater',
    damper: 'Damper',
    dehumidifier: 'Dehumidifier',
    light: 'Light',
  };
  return <Tag color="purple">{label[type]}</Tag>;
}

export default function ChamberDesignPage() {
  const { message } = App.useApp();
  const [sensorForm] = Form.useForm();
  const [actuatorForm] = Form.useForm();

  const [chambers, setChambers] = useState<ChamberModel[]>(chamberSeeds);
  const [selectedId, setSelectedId] = useState<string>(chamberSeeds[0]?.id ?? '');
  const [mode, setMode] = useState<'overview' | 'sensors' | 'actuators'>('overview');
  const [sensorModalOpen, setSensorModalOpen] = useState(false);
  const [actuatorModalOpen, setActuatorModalOpen] = useState(false);

  const selected = useMemo(
    () => chambers.find((chamber) => chamber.id === selectedId) ?? chambers[0] ?? null,
    [chambers, selectedId],
  );

  const totals = useMemo(() => {
    const allSensors = chambers.flatMap((item) => item.sensors);
    const allActuators = chambers.flatMap((item) => item.actuators);
    const onlineNodes = [...allSensors, ...allActuators].filter(
      (node) => node.status === 'online',
    ).length;
    const allNodes = allSensors.length + allActuators.length;

    return {
      chamberCount: chambers.length,
      sensorCount: allSensors.length,
      actuatorCount: allActuators.length,
      health: allNodes === 0 ? 100 : Math.round((onlineNodes / allNodes) * 100),
    };
  }, [chambers]);

  const chamberColumns = [
    {
      title: 'Buong say',
      key: 'chamberName',
      render: (_: unknown, row: ChamberModel) => (
        <div>
          <Text strong>{row.chamberCode}</Text>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{row.chamberName}</div>
        </div>
      ),
    },
    {
      title: 'Zone',
      dataIndex: 'zoneName',
      width: 110,
    },
    {
      title: 'Cam bien',
      key: 'sensorCount',
      width: 90,
      render: (_: unknown, row: ChamberModel) => row.sensors.length,
    },
    {
      title: 'Thiet bi',
      key: 'actuatorCount',
      width: 90,
      render: (_: unknown, row: ChamberModel) => row.actuators.length,
    },
    {
      title: 'Mode',
      key: 'mode',
      width: 100,
      render: (_: unknown, row: ChamberModel) => (
        <Tag color={row.mode === 'auto' ? 'green' : 'orange'}>{row.mode.toUpperCase()}</Tag>
      ),
    },
  ];

  const sensorColumns = [
    { title: 'Code', dataIndex: 'code', width: 120 },
    { title: 'Ten cam bien', dataIndex: 'name' },
    {
      title: 'Loai',
      dataIndex: 'sensorType',
      width: 120,
      render: (type: SensorType) => sensorTypeTag(type),
    },
    {
      title: 'Gia tri',
      key: 'value',
      width: 120,
      render: (_: unknown, row: SensorNode) => `${row.value} ${row.unit}`,
    },
    {
      title: 'Feed',
      dataIndex: 'feed',
      ellipsis: true,
    },
    {
      title: 'Trang thai',
      key: 'status',
      width: 130,
      render: (_: unknown, row: SensorNode) => {
        const mapped = statusToBadge(row.status);
        return <Badge color={mapped.color} text={mapped.text} />;
      },
    },
  ];

  const actuatorColumns = [
    { title: 'Code', dataIndex: 'code', width: 120 },
    { title: 'Ten thiet bi', dataIndex: 'name' },
    {
      title: 'Loai',
      dataIndex: 'actuatorType',
      width: 140,
      render: (type: ActuatorType) => actuatorTypeTag(type),
    },
    {
      title: 'Muc tai',
      key: 'level',
      width: 160,
      render: (_: unknown, row: ActuatorNode) => (
        <Progress percent={row.level} size="small" status={row.level > 85 ? 'exception' : 'normal'} />
      ),
    },
    {
      title: 'Feed',
      dataIndex: 'feed',
      ellipsis: true,
    },
    {
      title: 'Trang thai',
      key: 'status',
      width: 130,
      render: (_: unknown, row: ActuatorNode) => {
        const mapped = statusToBadge(row.status);
        return <Badge color={mapped.color} text={mapped.text} />;
      },
    },
  ];

  const addSensor = async () => {
    if (!selected) return;
    try {
      const values = await sensorForm.validateFields();
      const nextSensor: SensorNode = {
        id: `sensor-${Date.now()}`,
        code: String(values.code).trim(),
        name: String(values.name).trim(),
        sensorType: values.sensorType as SensorType,
        value: Number(values.value),
        unit: String(values.unit).trim(),
        feed: String(values.feed).trim(),
        status: values.status as DeviceStatus,
      };

      setChambers((prev) =>
        prev.map((item) =>
          item.id === selected.id
            ? { ...item, sensors: [...item.sensors, nextSensor] }
            : item,
        ),
      );

      message.success('Da them cam bien vao mock UI.');
      setSensorModalOpen(false);
      sensorForm.resetFields();
    } catch {
      // Keep form errors.
    }
  };

  const addActuator = async () => {
    if (!selected) return;
    try {
      const values = await actuatorForm.validateFields();
      const nextActuator: ActuatorNode = {
        id: `actuator-${Date.now()}`,
        code: String(values.code).trim(),
        name: String(values.name).trim(),
        actuatorType: values.actuatorType as ActuatorType,
        level: Number(values.level),
        feed: String(values.feed).trim(),
        status: values.status as DeviceStatus,
      };

      setChambers((prev) =>
        prev.map((item) =>
          item.id === selected.id
            ? { ...item, actuators: [...item.actuators, nextActuator] }
            : item,
        ),
      );

      message.success('Da them thiet bi dieu khien vao mock UI.');
      setActuatorModalOpen(false);
      actuatorForm.resetFields();
    } catch {
      // Keep form errors.
    }
  };

  if (!selected) {
    return <Alert type="warning" message="Chua co du lieu mock chamber." showIcon />;
  }

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ApartmentOutlined style={{ marginRight: 8, color: '#1677ff' }} />
          Chamber Design Studio (Mock)
        </Title>
        <Text type="secondary">
          Demo UI theo model: 1 buong say co the gan nhieu cam bien va nhieu thiet bi dieu khien.
        </Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Buong say" value={totals.chamberCount} prefix={<DashboardOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Tong cam bien" value={totals.sensorCount} prefix={<RadarChartOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Tong actuator" value={totals.actuatorCount} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic title="Node health" value={totals.health} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title="Danh sach buong say"
            extra={<Tag color="blue">Mock</Tag>}
            style={{ height: '100%' }}
          >
            <Table
              rowKey="id"
              dataSource={chambers}
              columns={chamberColumns}
              pagination={false}
              size="small"
              rowSelection={{
                type: 'radio',
                selectedRowKeys: [selected.id],
                onChange: (keys) => {
                  const next = String(keys[0] ?? '');
                  if (next) setSelectedId(next);
                },
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={`${selected.chamberCode} - ${selected.chamberName}`}
            extra={
              <Space>
                <Tag color={selected.mode === 'auto' ? 'green' : 'orange'}>
                  {selected.mode.toUpperCase()}
                </Tag>
                <Tag
                  color={
                    selected.batchStatus === 'running'
                      ? 'blue'
                      : selected.batchStatus === 'warning'
                        ? 'volcano'
                        : 'default'
                  }
                >
                  {selected.batchStatus.toUpperCase()}
                </Tag>
              </Space>
            }
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 14 }}
              message="UI demo de duyet luong"
              description="Sau khi duyet UI, se tiep tuc mapping API/DTO backend theo model chamber-thiet bi."
            />

            <Segmented
              value={mode}
              onChange={(val) => setMode(val as typeof mode)}
              options={[
                { label: 'Tong quan', value: 'overview' },
                { label: 'Cam bien', value: 'sensors' },
                { label: 'Actuator', value: 'actuators' },
              ]}
              style={{ marginBottom: 14 }}
            />

            {mode === 'overview' && (
              <div>
                <Row gutter={[12, 12]}>
                  <Col xs={24} md={12}>
                    <Card size="small" title="Sensor nodes">
                      <Space direction="vertical" style={{ width: '100%' }} size={8}>
                        <Text strong>{selected.sensors.length} node</Text>
                        {selected.sensors.slice(0, 3).map((sensor) => (
                          <div key={sensor.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>{sensor.name}</Text>
                            <Tag>{`${sensor.value} ${sensor.unit}`}</Tag>
                          </div>
                        ))}
                        {selected.sensors.length === 0 && (
                          <Text type="secondary">Chua co sensor trong buong nay.</Text>
                        )}
                      </Space>
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card size="small" title="Actuator nodes">
                      <Space direction="vertical" style={{ width: '100%' }} size={8}>
                        <Text strong>{selected.actuators.length} node</Text>
                        {selected.actuators.slice(0, 3).map((actuator) => (
                          <div key={actuator.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text>{actuator.name}</Text>
                            <Tag color="purple">{`${actuator.level}%`}</Tag>
                          </div>
                        ))}
                        {selected.actuators.length === 0 && (
                          <Text type="secondary">Chua co actuator trong buong nay.</Text>
                        )}
                      </Space>
                    </Card>
                  </Col>
                </Row>

                <Divider />

                <Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setSensorModalOpen(true)}>
                    Them Sensor
                  </Button>
                  <Button icon={<PlusOutlined />} onClick={() => setActuatorModalOpen(true)}>
                    Them Actuator
                  </Button>
                </Space>
              </div>
            )}

            {mode === 'sensors' && (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setSensorModalOpen(true)}>
                    Them Sensor
                  </Button>
                  <Tag>{`${selected.sensors.length} sensor`}</Tag>
                </Space>
                <Table
                  rowKey="id"
                  dataSource={selected.sensors}
                  columns={sensorColumns}
                  pagination={false}
                  size="small"
                />
              </div>
            )}

            {mode === 'actuators' && (
              <div>
                <Space style={{ marginBottom: 12 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setActuatorModalOpen(true)}>
                    Them Actuator
                  </Button>
                  <Tag>{`${selected.actuators.length} actuator`}</Tag>
                </Space>
                <Table
                  rowKey="id"
                  dataSource={selected.actuators}
                  columns={actuatorColumns}
                  pagination={false}
                  size="small"
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title={`Them sensor vao ${selected.chamberCode}`}
        open={sensorModalOpen}
        onCancel={() => setSensorModalOpen(false)}
        onOk={() => void addSensor()}
        okText="Them"
      >
        <Form
          form={sensorForm}
          layout="vertical"
          initialValues={{ sensorType: 'temperature', unit: '°C', value: 0, status: 'online' }}
        >
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Nhap code.' }]}>
            <Input placeholder="SEN-A1-T3" />
          </Form.Item>
          <Form.Item name="name" label="Ten sensor" rules={[{ required: true, message: 'Nhap ten sensor.' }]}>
            <Input placeholder="Nhiet do gan tran" />
          </Form.Item>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item name="sensorType" label="Loai">
                <Select
                  options={[
                    { value: 'temperature', label: 'Temperature' },
                    { value: 'humidity', label: 'Humidity' },
                    { value: 'light', label: 'Light' },
                    { value: 'co2', label: 'CO2' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Trang thai">
                <Select
                  options={[
                    { value: 'online', label: 'Online' },
                    { value: 'offline', label: 'Offline' },
                    { value: 'maintenance', label: 'Maintenance' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item name="value" label="Gia tri mac dinh">
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Don vi">
                <Input placeholder="°C" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="feed" label="MQTT Feed" rules={[{ required: true, message: 'Nhap feed.' }]}>
            <Input placeholder="drytech.m-a1-temp-top" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Them actuator vao ${selected.chamberCode}`}
        open={actuatorModalOpen}
        onCancel={() => setActuatorModalOpen(false)}
        onOk={() => void addActuator()}
        okText="Them"
      >
        <Form
          form={actuatorForm}
          layout="vertical"
          initialValues={{ actuatorType: 'fan', level: 0, status: 'online' }}
        >
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Nhap code.' }]}>
            <Input placeholder="ACT-A1-F2" />
          </Form.Item>
          <Form.Item name="name" label="Ten actuator" rules={[{ required: true, message: 'Nhap ten actuator.' }]}>
            <Input placeholder="Quat cap gio 2" />
          </Form.Item>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item name="actuatorType" label="Loai">
                <Select
                  options={[
                    { value: 'fan', label: 'Fan' },
                    { value: 'heater', label: 'Heater' },
                    { value: 'damper', label: 'Damper' },
                    { value: 'dehumidifier', label: 'Dehumidifier' },
                    { value: 'light', label: 'Light' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Trang thai">
                <Select
                  options={[
                    { value: 'online', label: 'Online' },
                    { value: 'offline', label: 'Offline' },
                    { value: 'maintenance', label: 'Maintenance' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="level" label="Power level (0-100)">
            <Input type="number" min={0} max={100} />
          </Form.Item>
          <Form.Item name="feed" label="MQTT Feed" rules={[{ required: true, message: 'Nhap feed.' }]}>
            <Input placeholder="drytech.m-a1-fan-2" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
