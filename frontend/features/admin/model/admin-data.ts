/**
 * data/adminData.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * NGUỒN SỰ THẬT cho dữ liệu Admin: Users, Zones, IoT Devices, Thresholds, Audit Logs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type UserRole = 'Admin' | 'Manager' | 'Operator';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  zones: string[];
  status: 'Active' | 'Inactive';
  createdAt: string;
  lastLogin: string;
}

export interface Zone {
  id: string;
  name: string;
  description: string;
  deviceCount: number;
  machineCount: number;
  staffCount: number;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface IoTDevice {
  id: string;
  deviceId: string;
  macAddress: string;
  name: string;
  type: string;
  zone: string;
  mqttTopicSensor: string;
  mqttTopicCommand: string;
  /** Adafruit IO Feed Group prefix (ví dụ: "drytech") */
  aioFeedGroup?: string;
  active: boolean;
  connected: boolean;
  lastSeen: string;
  firmware: string;
}

export interface SystemThresholds {
  maxTempSafe: number;
  minHumidity: number;
  maxHumidity: number;
  autoStopEnabled: boolean;
  alertDelaySeconds: number;
  mqttBrokerHost: string;
  mqttBrokerPort: number;
  mqttKeepAlive: number;
  dataRetentionDays: number;
  batchAutoArchiveDays: number;
  lightSensorThreshold: number;
  doorOpenTimeout: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: UserRole;
  action: string;
  target: string;
  detail: string;
  level: 'info' | 'warning' | 'error' | 'success';
  ip: string;
}

// ── Users ──────────────────────────────────────────────────────────────────
export const initialUsers: AppUser[] = [
  { id: 'u1', name: 'Alex Morgan',     email: 'alex@drytech.io',    role: 'Manager',  zones: ['Zone A', 'Zone B'], status: 'Active',   createdAt: '2024-01-10', lastLogin: '2024-11-20 08:12' },
  { id: 'u2', name: 'Nguyễn Văn An',  email: 'an@drytech.io',      role: 'Operator', zones: ['Zone A'],           status: 'Active',   createdAt: '2024-02-14', lastLogin: '2024-11-20 07:58' },
  { id: 'u3', name: 'Trần Thị Bình',  email: 'binh@drytech.io',    role: 'Operator', zones: ['Zone B'],           status: 'Active',   createdAt: '2024-02-14', lastLogin: '2024-11-19 16:40' },
  { id: 'u4', name: 'Lê Văn Cường',   email: 'cuong@drytech.io',   role: 'Operator', zones: ['Zone C'],           status: 'Active',   createdAt: '2024-03-01', lastLogin: '2024-11-20 07:30' },
  { id: 'u5', name: 'Phạm Thị Dung',  email: 'dung@drytech.io',    role: 'Manager',  zones: ['Zone C', 'Zone D'], status: 'Active',   createdAt: '2024-03-15', lastLogin: '2024-11-18 09:00' },
  { id: 'u6', name: 'Hoàng Minh Đức', email: 'duc@drytech.io',     role: 'Operator', zones: ['Zone D'],           status: 'Inactive', createdAt: '2024-04-01', lastLogin: '2024-10-01 14:22' },
  { id: 'u7', name: 'Super Admin',     email: 'admin@drytech.io',   role: 'Admin',    zones: [],                  status: 'Active',   createdAt: '2024-01-01', lastLogin: '2024-11-20 09:05' },
];

// ── Zones ──────────────────────────────────────────────────────────────────
export const initialZones: Zone[] = [
  { id: 'za', name: 'Zone A', description: 'Khu vực sấy trái cây nhiệt đới – 4 máy', deviceCount: 4, machineCount: 4, staffCount: 1, status: 'Active',   createdAt: '2024-01-05' },
  { id: 'zb', name: 'Zone B', description: 'Khu vực sấy nông sản – 3 máy',           deviceCount: 3, machineCount: 3, staffCount: 1, status: 'Active',   createdAt: '2024-01-05' },
  { id: 'zc', name: 'Zone C', description: 'Khu vực sấy rau củ – 2 máy',             deviceCount: 2, machineCount: 2, staffCount: 1, status: 'Active',   createdAt: '2024-02-10' },
  { id: 'zd', name: 'Zone D', description: 'Khu vực sấy thực phẩm khô – 3 máy',     deviceCount: 3, machineCount: 3, staffCount: 0, status: 'Active',   createdAt: '2024-03-20' },
  { id: 'ze', name: 'Zone E', description: 'Khu vực dự phòng – chưa kích hoạt',      deviceCount: 0, machineCount: 0, staffCount: 0, status: 'Inactive', createdAt: '2024-06-01' },
];

// ── IoT Devices ───────────────────────────────────────────────────────────
export const initialDevices: IoTDevice[] = [
  { id: 'd1',  deviceId: 'DT-A1-001', macAddress: 'A4:C3:F0:85:AC:11', name: 'Máy sấy A1', type: 'Dryer', zone: 'Zone A', mqttTopicSensor: 'drytech/zone-a/m-a1/sensor', mqttTopicCommand: 'drytech/zone-a/m-a1/cmd', active: true,  connected: true,  lastSeen: '2s ago',  firmware: 'v2.3.1' },
  { id: 'd2',  deviceId: 'DT-A2-002', macAddress: 'A4:C3:F0:85:AC:22', name: 'Máy sấy A2', type: 'Dryer', zone: 'Zone A', mqttTopicSensor: 'drytech/zone-a/m-a2/sensor', mqttTopicCommand: 'drytech/zone-a/m-a2/cmd', active: true,  connected: true,  lastSeen: '5s ago',  firmware: 'v2.3.1' },
  { id: 'd3',  deviceId: 'DT-A3-003', macAddress: 'A4:C3:F0:85:AC:33', name: 'Máy sấy A3', type: 'Dryer', zone: 'Zone A', mqttTopicSensor: 'drytech/zone-a/m-a3/sensor', mqttTopicCommand: 'drytech/zone-a/m-a3/cmd', active: true,  connected: true,  lastSeen: '3s ago',  firmware: 'v2.3.0' },
  { id: 'd4',  deviceId: 'DT-A4-004', macAddress: 'A4:C3:F0:85:AC:44', name: 'Máy sấy A4', type: 'Dryer', zone: 'Zone A', mqttTopicSensor: 'drytech/zone-a/m-a4/sensor', mqttTopicCommand: 'drytech/zone-a/m-a4/cmd', active: false, connected: false, lastSeen: '2h ago',  firmware: 'v2.2.8' },
  { id: 'd5',  deviceId: 'DT-B1-005', macAddress: 'B8:D7:E1:44:BC:11', name: 'Máy sấy B1', type: 'Dryer', zone: 'Zone B', mqttTopicSensor: 'drytech/zone-b/m-b1/sensor', mqttTopicCommand: 'drytech/zone-b/m-b1/cmd', active: true,  connected: true,  lastSeen: '1s ago',  firmware: 'v2.3.1' },
  { id: 'd6',  deviceId: 'DT-B2-006', macAddress: 'B8:D7:E1:44:BC:22', name: 'Máy sấy B2', type: 'Dryer', zone: 'Zone B', mqttTopicSensor: 'drytech/zone-b/m-b2/sensor', mqttTopicCommand: 'drytech/zone-b/m-b2/cmd', active: true,  connected: true,  lastSeen: '8s ago',  firmware: 'v2.3.1' },
  { id: 'd7',  deviceId: 'DT-B3-007', macAddress: 'B8:D7:E1:44:BC:33', name: 'Máy sấy B3', type: 'Dryer', zone: 'Zone B', mqttTopicSensor: 'drytech/zone-b/m-b3/sensor', mqttTopicCommand: 'drytech/zone-b/m-b3/cmd', active: true,  connected: true,  lastSeen: '4s ago',  firmware: 'v2.3.0' },
  { id: 'd8',  deviceId: 'DT-C1-008', macAddress: 'CC:50:E3:12:DD:01', name: 'Máy sấy C1', type: 'Dryer', zone: 'Zone C', mqttTopicSensor: 'drytech/zone-c/m-c1/sensor', mqttTopicCommand: 'drytech/zone-c/m-c1/cmd', active: true,  connected: true,  lastSeen: '2s ago',  firmware: 'v2.3.1' },
  { id: 'd9',  deviceId: 'DT-C2-009', macAddress: 'CC:50:E3:12:DD:02', name: 'Máy sấy C2', type: 'Dryer', zone: 'Zone C', mqttTopicSensor: 'drytech/zone-c/m-c2/sensor', mqttTopicCommand: 'drytech/zone-c/m-c2/cmd', active: true,  connected: true,  lastSeen: '6s ago',  firmware: 'v2.3.1' },
  { id: 'd10', deviceId: 'DT-D1-010', macAddress: 'D4:AD:20:9C:EE:01', name: 'Máy sấy D1', type: 'Dryer', zone: 'Zone D', mqttTopicSensor: 'drytech/zone-d/m-d1/sensor', mqttTopicCommand: 'drytech/zone-d/m-d1/cmd', active: true,  connected: true,  lastSeen: '3s ago',  firmware: 'v2.3.1' },
  { id: 'd11', deviceId: 'DT-D2-011', macAddress: 'D4:AD:20:9C:EE:02', name: 'Máy sấy D2', type: 'Dryer', zone: 'Zone D', mqttTopicSensor: 'drytech/zone-d/m-d2/sensor', mqttTopicCommand: 'drytech/zone-d/m-d2/cmd', active: true,  connected: true,  lastSeen: '1s ago',  firmware: 'v2.3.1' },
  { id: 'd12', deviceId: 'DT-D3-012', macAddress: 'D4:AD:20:9C:EE:03', name: 'Máy sấy D3', type: 'Dryer', zone: 'Zone D', mqttTopicSensor: 'drytech/zone-d/m-d3/sensor', mqttTopicCommand: 'drytech/zone-d/m-d3/cmd', active: true,  connected: true,  lastSeen: '7s ago',  firmware: 'v2.2.9' },
];

// ── System Thresholds ─────────────────────────────────────────────────────
export const defaultThresholds: SystemThresholds = {
  maxTempSafe:          90,
  minHumidity:          8,
  maxHumidity:          85,
  autoStopEnabled:      true,
  alertDelaySeconds:    15,
  mqttBrokerHost:       'mqtt.drytech.internal',
  mqttBrokerPort:       1883,
  mqttKeepAlive:        60,
  dataRetentionDays:    365,
  batchAutoArchiveDays: 90,
  lightSensorThreshold: 500,
  doorOpenTimeout:      5,
};

// ── Audit Logs ────────────────────────────────────────────────────────────
export const auditLogs: AuditLog[] = [
  { id: 'al01', timestamp: '2024-11-20 09:05:12', user: 'Super Admin',    role: 'Admin',    action: 'LOGIN',            target: 'System',           detail: 'Đăng nhập thành công',                                       level: 'info',    ip: '192.168.1.10' },
  { id: 'al02', timestamp: '2024-11-20 09:06:44', user: 'Super Admin',    role: 'Admin',    action: 'UPDATE_THRESHOLD', target: 'SystemThresholds', detail: 'maxTempSafe: 85 → 90°C',                                     level: 'warning', ip: '192.168.1.10' },
  { id: 'al03', timestamp: '2024-11-20 08:30:11', user: 'Alex Morgan',    role: 'Manager',  action: 'START_BATCH',      target: 'M-A1',             detail: 'Khởi động mẻ sấy: Xoài sấy dẻo',                            level: 'success', ip: '192.168.1.20' },
  { id: 'al04', timestamp: '2024-11-20 08:12:33', user: 'Alex Morgan',    role: 'Manager',  action: 'LOGIN',            target: 'System',           detail: 'Đăng nhập thành công',                                       level: 'info',    ip: '192.168.1.20' },
  { id: 'al05', timestamp: '2024-11-20 07:58:01', user: 'Nguyễn Văn An', role: 'Operator', action: 'LOGIN',            target: 'System',           detail: 'Đăng nhập thành công',                                       level: 'info',    ip: '192.168.1.31' },
  { id: 'al06', timestamp: '2024-11-20 07:59:45', user: 'Nguyễn Văn An', role: 'Operator', action: 'ACK_ALERT',        target: 'M-B2',             detail: 'Xác nhận cảnh báo ERR-HT-04',                                level: 'warning', ip: '192.168.1.31' },
  { id: 'al07', timestamp: '2024-11-20 08:00:20', user: 'Nguyễn Văn An', role: 'Operator', action: 'RESOLVE_ERROR',    target: 'M-B2',             detail: 'Ghi chú: Cắm lại cảm biến nhiệt, reset module',              level: 'success', ip: '192.168.1.31' },
  { id: 'al08', timestamp: '2024-11-19 17:30:00', user: 'Super Admin',    role: 'Admin',    action: 'CREATE_USER',      target: 'Lê Văn Cường',     detail: 'Tạo tài khoản Operator – Zone C',                            level: 'info',    ip: '192.168.1.10' },
  { id: 'al09', timestamp: '2024-11-19 17:28:15', user: 'Super Admin',    role: 'Admin',    action: 'DEVICE_TOGGLE',    target: 'DT-A4-004',        detail: 'Chuyển thiết bị sang Inactive',                              level: 'warning', ip: '192.168.1.10' },
  { id: 'al10', timestamp: '2024-11-19 16:40:55', user: 'Trần Thị Bình', role: 'Operator', action: 'STOP_BATCH',       target: 'M-B3',             detail: 'Dừng mẻ sấy sớm – Tiến độ 78%',                             level: 'warning', ip: '192.168.1.32' },
  { id: 'al11', timestamp: '2024-11-19 14:00:00', user: 'System',         role: 'Admin',    action: 'AUTO_STOP',        target: 'M-A3',             detail: 'Dừng khẩn cấp – nhiệt độ vượt ngưỡng 91°C (max: 90°C)',    level: 'error',   ip: '127.0.0.1'    },
  { id: 'al12', timestamp: '2024-11-19 13:58:10', user: 'System',         role: 'Admin',    action: 'THRESHOLD_ALERT',  target: 'M-A3',             detail: 'Cảnh báo nhiệt độ 91°C vượt ngưỡng an toàn',               level: 'error',   ip: '127.0.0.1'    },
  { id: 'al13', timestamp: '2024-11-18 09:00:00', user: 'Phạm Thị Dung', role: 'Manager',  action: 'EXPORT_REPORT',    target: 'BatchHistory',     detail: 'Xuất báo cáo PDF – Tháng 10/2024',                          level: 'info',    ip: '192.168.1.21' },
  { id: 'al14', timestamp: '2024-11-18 08:30:00', user: 'Super Admin',    role: 'Admin',    action: 'CREATE_ZONE',      target: 'Zone E',           detail: 'Tạo Zone E – Khu vực dự phòng',                             level: 'info',    ip: '192.168.1.10' },
  { id: 'al15', timestamp: '2024-11-17 15:00:00', user: 'Super Admin',    role: 'Admin',    action: 'UPDATE_DEVICE',    target: 'DT-D3-012',        detail: 'Cập nhật MQTT Topic: drytech/zone-d/m-d3/sensor',           level: 'info',    ip: '192.168.1.10' },
];

// ── Aliases for backward compatibility ────────────────────────────────────
export const initialThresholds = defaultThresholds;
export const initialAuditLogs = auditLogs;
