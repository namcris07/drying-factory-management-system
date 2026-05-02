/**
 * seed-data.ts – All raw data arrays consumed by seed.ts
 */

// ── Organizations ───────────────────────────────────────────────────────────
export const orgData = [
  { id: 1, name: 'DryTech Việt Nam', code: 'DTVN', status: 'Active' },
];

// ── Factories ───────────────────────────────────────────────────────────────
export const factoryData = [
  { id: 1, name: 'Nhà máy Bình Dương', code: 'BD-01', orgID: 1, status: 'Active' },
  { id: 2, name: 'Nhà máy Long An', code: 'LA-01', orgID: 1, status: 'Active' },
];

// ── Sites ───────────────────────────────────────────────────────────────────
export const siteData = [
  { id: 1, name: 'Khu vực sản xuất chính', code: 'BD-MAIN', factoryID: 1, status: 'Active' },
  { id: 2, name: 'Khu vực mở rộng', code: 'BD-EXT', factoryID: 1, status: 'Active' },
  { id: 3, name: 'Khu vực sản xuất', code: 'LA-MAIN', factoryID: 2, status: 'Active' },
];

// ── Users ───────────────────────────────────────────────────────────────────
export const userData = [
  { id: 1, first: 'Super', last: 'Admin', email: 'admin@drytech.io', pass: 'admin123', role: 'Admin', orgID: 1, factID: null, siteID: null, created: '2024-01-01' },
  { id: 2, first: 'Nguyễn Chu Hải', last: 'Nam', email: 'manager@drytech.io', pass: '123456', role: 'Manager', orgID: 1, factID: 1, siteID: null, created: '2024-01-10' },
  { id: 3, first: 'Nguyễn Văn', last: 'An', email: 'op_a@drytech.io', pass: 'op123', role: 'Operator', orgID: 1, factID: 1, siteID: 1, created: '2024-02-14' },
  { id: 4, first: 'Trần Thị', last: 'Bình', email: 'op_b@drytech.io', pass: 'op123', role: 'Operator', orgID: 1, factID: 1, siteID: 1, created: '2024-03-01' },
  { id: 5, first: 'Lê Văn', last: 'Cường', email: 'op_c@drytech.io', pass: 'op123', role: 'Operator', orgID: 1, factID: 1, siteID: 2, created: '2024-03-15' },
  { id: 6, first: 'Phạm Minh', last: 'Đức', email: 'manager2@drytech.io', pass: '123456', role: 'Manager', orgID: 1, factID: 2, siteID: null, created: '2024-04-01' },
  { id: 7, first: 'Hoàng Thị', last: 'Mai', email: 'op_d@drytech.io', pass: 'op123', role: 'Operator', orgID: 1, factID: 2, siteID: 3, created: '2024-04-10' },
  { id: 8, first: 'Võ Văn', last: 'Hùng', email: 'op_e@drytech.io', pass: 'op123', role: 'Operator', orgID: 1, factID: 2, siteID: 3, created: '2024-05-01' },
];

// ── Zones ───────────────────────────────────────────────────────────────────
export const zoneData = [
  { id: 1, name: 'Zone A – Sấy trái cây', desc: 'Khu sấy chính cho trái cây nhiệt đới – 3 buồng công suất cao', userID: 3, orgID: 1, factID: 1, siteID: 1 },
  { id: 2, name: 'Zone B – Sấy nông sản', desc: 'Khu sấy nông sản củ quả – 2 buồng trung bình', userID: 4, orgID: 1, factID: 1, siteID: 1 },
  { id: 3, name: 'Zone C – Sấy thử nghiệm', desc: 'Khu sấy R&D, thử nghiệm công thức mới', userID: 3, orgID: 1, factID: 1, siteID: 1 },
  { id: 4, name: 'Zone D – Mở rộng', desc: 'Khu sấy mở rộng Bình Dương – 2 buồng mới lắp đặt', userID: 5, orgID: 1, factID: 1, siteID: 2 },
  { id: 5, name: 'Zone E – Long An chính', desc: 'Khu sấy chính Long An – chuyên trái cây xuất khẩu', userID: 7, orgID: 1, factID: 2, siteID: 3 },
  { id: 6, name: 'Zone F – Long An phụ', desc: 'Khu sấy phụ Long An – gia vị & thảo mộc', userID: 8, orgID: 1, factID: 2, siteID: 3 },
];

// ── Devices (Buồng sấy) ────────────────────────────────────────────────────
type SensorDef = { sensorName: string; sensorType: string; feedKey: string; status: string; unit?: string };
type ActuatorDef = { actuatorName: string; actuatorType: string; feedKey: string; status: string; onVal: string; offVal: string };

interface DeviceDef {
  id: number; name: string; type: string; zoneID: number; status: string;
  orgID: number; factID: number; siteID: number;
  sensors: SensorDef[]; actuators: ActuatorDef[];
}

const stdSensors = (prefix: string): SensorDef[] => [
  { sensorName: 'Nhiệt độ vào', sensorType: 'TemperatureSensor', feedKey: `${prefix}-temp-in`, status: 'Active', unit: '°C' },
  { sensorName: 'Độ ẩm lõi', sensorType: 'HumiditySensor', feedKey: `${prefix}-humidity-core`, status: 'Active', unit: '%' },
  { sensorName: 'Ánh sáng cửa', sensorType: 'LightSensor', feedKey: `${prefix}-light-door`, status: 'Active', unit: 'lux' },
];

const stdActuators = (prefix: string): ActuatorDef[] => [
  { actuatorName: 'Quạt chính', actuatorType: 'Fan', feedKey: `${prefix}-fan-1`, status: 'Active', onVal: '1', offVal: '0' },
  { actuatorName: 'LED trạng thái', actuatorType: 'LED', feedKey: `${prefix}-led`, status: 'Active', onVal: '1', offVal: '0' },
  { actuatorName: 'LCD buồng', actuatorType: 'LCD', feedKey: `${prefix}-lcd`, status: 'Active', onVal: '1', offVal: '0' },
];

export const deviceData: DeviceDef[] = [
  // Zone A – 3 buồng
  { id: 1, name: 'Buồng sấy A1', type: 'DryingChamber', zoneID: 1, status: 'Active', orgID: 1, factID: 1, siteID: 1,
    sensors: [...stdSensors('drytech.m-a1'), { sensorName: 'Nhiệt độ lõi', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-a1-temp-core', status: 'Active', unit: '°C' }],
    actuators: [...stdActuators('drytech.m-a1'), { actuatorName: 'Bơm nước', actuatorType: 'Pump', feedKey: 'drytech.m-a1-pump', status: 'Active', onVal: '1', offVal: '0' }],
  },
  { id: 2, name: 'Buồng sấy A2', type: 'DryingChamber', zoneID: 1, status: 'Active', orgID: 1, factID: 1, siteID: 1,
    sensors: [...stdSensors('drytech.m-a2'), { sensorName: 'Nhiệt độ lõi', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-a2-temp-core', status: 'Active', unit: '°C' }],
    actuators: [...stdActuators('drytech.m-a2'), { actuatorName: 'Quạt phụ', actuatorType: 'Fan', feedKey: 'drytech.m-a2-fan-2', status: 'Active', onVal: '1', offVal: '0' }],
  },
  { id: 3, name: 'Buồng sấy A3', type: 'DryingChamber', zoneID: 1, status: 'Active', orgID: 1, factID: 1, siteID: 1,
    sensors: stdSensors('drytech.m-a3'),
    actuators: stdActuators('drytech.m-a3'),
  },
  // Zone B – 2 buồng
  { id: 4, name: 'Buồng sấy B1', type: 'DryingChamber', zoneID: 2, status: 'Active', orgID: 1, factID: 1, siteID: 1,
    sensors: [...stdSensors('drytech.m-b1'), { sensorName: 'CO2', sensorType: 'GasSensor', feedKey: 'drytech.m-b1-co2', status: 'Active', unit: 'ppm' }],
    actuators: [...stdActuators('drytech.m-b1'), { actuatorName: 'Van xả', actuatorType: 'Valve', feedKey: 'drytech.m-b1-valve', status: 'Active', onVal: '1', offVal: '0' }],
  },
  { id: 5, name: 'Buồng sấy B2', type: 'DryingChamber', zoneID: 2, status: 'Maintenance', orgID: 1, factID: 1, siteID: 1,
    sensors: stdSensors('drytech.m-b2'),
    actuators: stdActuators('drytech.m-b2'),
  },
  // Zone C – 1 buồng thử nghiệm
  { id: 6, name: 'Buồng sấy C1 (R&D)', type: 'DryingChamber', zoneID: 3, status: 'Active', orgID: 1, factID: 1, siteID: 1,
    sensors: [...stdSensors('drytech.m-c1'), { sensorName: 'Cân trọng lượng', sensorType: 'WeightSensor', feedKey: 'drytech.m-c1-weight', status: 'Active', unit: 'kg' }],
    actuators: [...stdActuators('drytech.m-c1'), { actuatorName: 'Máy sưởi phụ', actuatorType: 'Heater', feedKey: 'drytech.m-c1-heater', status: 'Active', onVal: '1', offVal: '0' }],
  },
  // Zone D – 2 buồng mở rộng
  { id: 7, name: 'Buồng sấy D1', type: 'DryingChamber', zoneID: 4, status: 'Active', orgID: 1, factID: 1, siteID: 2,
    sensors: stdSensors('drytech.m-d1'),
    actuators: stdActuators('drytech.m-d1'),
  },
  { id: 8, name: 'Buồng sấy D2', type: 'DryingChamber', zoneID: 4, status: 'Active', orgID: 1, factID: 1, siteID: 2,
    sensors: stdSensors('drytech.m-d2'),
    actuators: [...stdActuators('drytech.m-d2'), { actuatorName: 'Quạt phụ', actuatorType: 'Fan', feedKey: 'drytech.m-d2-fan-2', status: 'Active', onVal: '1', offVal: '0' }],
  },
  // Zone E – 3 buồng Long An
  { id: 9, name: 'Buồng sấy E1', type: 'DryingChamber', zoneID: 5, status: 'Active', orgID: 1, factID: 2, siteID: 3,
    sensors: [...stdSensors('drytech.m-e1'), { sensorName: 'Nhiệt độ ra', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-e1-temp-out', status: 'Active', unit: '°C' }],
    actuators: [...stdActuators('drytech.m-e1'), { actuatorName: 'Bơm nước', actuatorType: 'Pump', feedKey: 'drytech.m-e1-pump', status: 'Active', onVal: '1', offVal: '0' }],
  },
  { id: 10, name: 'Buồng sấy E2', type: 'DryingChamber', zoneID: 5, status: 'Active', orgID: 1, factID: 2, siteID: 3,
    sensors: stdSensors('drytech.m-e2'),
    actuators: stdActuators('drytech.m-e2'),
  },
  { id: 11, name: 'Buồng sấy E3', type: 'DryingChamber', zoneID: 5, status: 'Inactive', orgID: 1, factID: 2, siteID: 3,
    sensors: stdSensors('drytech.m-e3'),
    actuators: stdActuators('drytech.m-e3'),
  },
  // Zone F – 1 buồng gia vị
  { id: 12, name: 'Buồng sấy F1 (Gia vị)', type: 'DryingChamber', zoneID: 6, status: 'Active', orgID: 1, factID: 2, siteID: 3,
    sensors: [...stdSensors('drytech.m-f1'), { sensorName: 'CO2', sensorType: 'GasSensor', feedKey: 'drytech.m-f1-co2', status: 'Active', unit: 'ppm' }],
    actuators: [...stdActuators('drytech.m-f1'), { actuatorName: 'Quạt hút ẩm', actuatorType: 'Fan', feedKey: 'drytech.m-f1-exhaust', status: 'Active', onVal: '1', offVal: '0' }],
  },
];

// ── Recipes ─────────────────────────────────────────────────────────────────
interface StageDef { stageOrder: number; duration: number; temp: number; hum: number }
interface RecipeDef { id: number; name: string; fruits: string; duration: number; userID: number; orgID: number; factID: number; siteID: number; active: boolean; stages: StageDef[] }

export const recipeData: RecipeDef[] = [
  { id: 1, name: 'Xoài sấy dẻo', fruits: 'Xoài', duration: 480, userID: 2, orgID: 1, factID: 1, siteID: 1, active: true,
    stages: [{ stageOrder: 1, duration: 120, temp: 58, hum: 28 }, { stageOrder: 2, duration: 240, temp: 65, hum: 18 }, { stageOrder: 3, duration: 120, temp: 60, hum: 15 }] },
  { id: 2, name: 'Chuối sấy giòn', fruits: 'Chuối', duration: 360, userID: 2, orgID: 1, factID: 1, siteID: 1, active: true,
    stages: [{ stageOrder: 1, duration: 90, temp: 64, hum: 25 }, { stageOrder: 2, duration: 270, temp: 70, hum: 15 }] },
  { id: 3, name: 'Dứa sấy dẻo', fruits: 'Dứa', duration: 600, userID: 2, orgID: 1, factID: 1, siteID: 1, active: true,
    stages: [{ stageOrder: 1, duration: 180, temp: 54, hum: 30 }, { stageOrder: 2, duration: 300, temp: 60, hum: 20 }, { stageOrder: 3, duration: 120, temp: 55, hum: 16 }] },
  { id: 4, name: 'Táo sấy lát mỏng', fruits: 'Táo', duration: 420, userID: 2, orgID: 1, factID: 1, siteID: 1, active: true,
    stages: [{ stageOrder: 1, duration: 120, temp: 50, hum: 20 }, { stageOrder: 2, duration: 300, temp: 55, hum: 12 }] },
  { id: 5, name: 'Khoai lang sấy', fruits: 'Khoai lang', duration: 300, userID: 2, orgID: 1, factID: 1, siteID: 1, active: true,
    stages: [{ stageOrder: 1, duration: 80, temp: 68, hum: 20 }, { stageOrder: 2, duration: 220, temp: 75, hum: 10 }] },
  { id: 6, name: 'Mít sấy khô', fruits: 'Mít', duration: 720, userID: 2, orgID: 1, factID: 1, siteID: 1, active: true,
    stages: [{ stageOrder: 1, duration: 180, temp: 53, hum: 26 }, { stageOrder: 2, duration: 360, temp: 58, hum: 16 }, { stageOrder: 3, duration: 180, temp: 55, hum: 13 }] },
  { id: 7, name: 'Thanh long sấy dẻo', fruits: 'Thanh long', duration: 540, userID: 6, orgID: 1, factID: 2, siteID: 3, active: true,
    stages: [{ stageOrder: 1, duration: 150, temp: 55, hum: 30 }, { stageOrder: 2, duration: 270, temp: 62, hum: 18 }, { stageOrder: 3, duration: 120, temp: 58, hum: 14 }] },
  { id: 8, name: 'Ổi sấy giòn', fruits: 'Ổi', duration: 390, userID: 6, orgID: 1, factID: 2, siteID: 3, active: true,
    stages: [{ stageOrder: 1, duration: 100, temp: 60, hum: 24 }, { stageOrder: 2, duration: 290, temp: 68, hum: 14 }] },
  { id: 9, name: 'Nghệ sấy khô', fruits: 'Nghệ', duration: 480, userID: 6, orgID: 1, factID: 2, siteID: 3, active: true,
    stages: [{ stageOrder: 1, duration: 120, temp: 50, hum: 22 }, { stageOrder: 2, duration: 240, temp: 60, hum: 12 }, { stageOrder: 3, duration: 120, temp: 55, hum: 8 }] },
  { id: 10, name: 'Gừng sấy lát', fruits: 'Gừng', duration: 360, userID: 6, orgID: 1, factID: 2, siteID: 3, active: true,
    stages: [{ stageOrder: 1, duration: 90, temp: 55, hum: 20 }, { stageOrder: 2, duration: 270, temp: 65, hum: 10 }] },
  { id: 11, name: 'Bưởi sấy dẻo', fruits: 'Bưởi', duration: 660, userID: 2, orgID: 1, factID: 1, siteID: 1, active: true,
    stages: [{ stageOrder: 1, duration: 180, temp: 52, hum: 28 }, { stageOrder: 2, duration: 300, temp: 58, hum: 18 }, { stageOrder: 3, duration: 180, temp: 54, hum: 14 }] },
  { id: 12, name: 'Cà chua sấy khô', fruits: 'Cà chua', duration: 540, userID: 2, orgID: 1, factID: 1, siteID: 1, active: false,
    stages: [{ stageOrder: 1, duration: 120, temp: 60, hum: 26 }, { stageOrder: 2, duration: 300, temp: 70, hum: 14 }, { stageOrder: 3, duration: 120, temp: 65, hum: 10 }] },
];

// ── Alerts ───────────────────────────────────────────────────────────────────
export const alertData = [
  { type: 'critical', msg: 'Nhiệt độ buồng A1 vượt ngưỡng 90°C – Tự động dừng mẻ sấy', deviceID: 1, status: 'resolved', daysAgo: 45 },
  { type: 'warning', msg: 'Độ ẩm buồng B1 thấp hơn 8% – kiểm tra cảm biến', deviceID: 4, status: 'resolved', daysAgo: 38 },
  { type: 'info', msg: 'Buồng sấy B2 vào chế độ bảo trì theo lịch', deviceID: 5, status: 'resolved', daysAgo: 30 },
  { type: 'critical', msg: 'Mất kết nối MQTT buồng E3 – kiểm tra mạng nhà máy Long An', deviceID: 11, status: 'resolved', daysAgo: 25 },
  { type: 'warning', msg: 'Quạt chính buồng A2 hoạt động không ổn định – rung lắc cao', deviceID: 2, status: 'resolved', daysAgo: 20 },
  { type: 'info', msg: 'Hệ thống cập nhật firmware v2.4.0 cho tất cả buồng Zone A', deviceID: 1, status: 'resolved', daysAgo: 18 },
  { type: 'warning', msg: 'Cảm biến CO2 buồng B1 cần hiệu chuẩn lại', deviceID: 4, status: 'resolved', daysAgo: 15 },
  { type: 'critical', msg: 'Nhiệt độ buồng D1 tăng đột biến – nghi lỗi điện trở sưởi', deviceID: 7, status: 'resolved', daysAgo: 12 },
  { type: 'warning', msg: 'Buồng E1 – Bơm nước không phản hồi sau 3 lần thử', deviceID: 9, status: 'acknowledged', daysAgo: 7 },
  { type: 'info', msg: 'Mẻ sấy Thanh long #287 hoàn thành trước thời gian dự kiến 30 phút', deviceID: 9, status: 'resolved', daysAgo: 5 },
  { type: 'warning', msg: 'Cảm biến ánh sáng cửa buồng F1 giá trị bất thường', deviceID: 12, status: 'active', daysAgo: 3 },
  { type: 'critical', msg: 'Buồng A3 – Mất tín hiệu cảm biến nhiệt hơn 10 phút', deviceID: 3, status: 'active', daysAgo: 1 },
  { type: 'info', msg: 'Lịch bảo trì định kỳ buồng B2 đã được lên kế hoạch', deviceID: 5, status: 'active', daysAgo: 0 },
  { type: 'warning', msg: 'LCD buồng D2 hiển thị lỗi – cần khởi động lại', deviceID: 8, status: 'active', daysAgo: 0 },
];

// ── System Config ───────────────────────────────────────────────────────────
export const configData: Record<string, string> = {
  maxTempSafe: '90',
  minHumidity: '8',
  maxHumidity: '85',
  autoStopEnabled: 'true',
  alertDelaySeconds: '15',
  mqttBrokerHost: 'mqtt.drytech.internal',
  mqttBrokerPort: '1883',
  mqttKeepAlive: '60',
  dataRetentionDays: '365',
  batchAutoArchiveDays: '90',
  lightSensorThreshold: '90',
  doorOpenTimeout: '5',
  operatingMode: 'auto',
  operatingModeFeed: 'mode_state',
  maintenanceIntervalDays: '30',
  maxConcurrentBatches: '10',
};
