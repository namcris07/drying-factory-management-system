/**
 * data/notificationData.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * In-memory notification store (module-level singleton).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type NotifSeverity = 'error' | 'warning' | 'info' | 'success';
export type NotifCategory = 'alert' | 'system' | 'batch';
export type NotifRole     = 'admin' | 'manager' | 'operator' | 'all';

export interface AppNotification {
  id: string;
  severity: NotifSeverity;
  category: NotifCategory;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  roles: NotifRole[];
  zone?: string;
}

let _notifications: AppNotification[] = [
  /* ── Cảnh báo (alert) ── */
  { id: 'n1',  severity: 'error',   category: 'alert',  title: 'Lỗi cảm biến nhiệt độ',        description: 'Máy sấy B2 – ERR-HT-04: Cảm biến mất kết nối. Cần kiểm tra ngay.',                    timestamp: new Date(Date.now() - 5 * 60_000),     read: false, roles: ['operator', 'manager', 'admin'], zone: 'Zone B' },
  { id: 'n2',  severity: 'warning', category: 'alert',  title: 'Nhiệt độ vượt ngưỡng',          description: 'Máy sấy C2 – nhiệt độ 88°C, vượt ngưỡng cảnh báo 85°C.',                             timestamp: new Date(Date.now() - 18 * 60_000),    read: false, roles: ['operator', 'manager'],          zone: 'Zone C' },
  { id: 'n3',  severity: 'warning', category: 'alert',  title: 'Cửa máy sấy đang mở',           description: 'Máy sấy C2 – cửa buồng sấy mở trong khi đang chạy công thức.',                       timestamp: new Date(Date.now() - 32 * 60_000),    read: true,  roles: ['operator'],                     zone: 'Zone C' },
  /* ── Hệ thống (system) ── */
  { id: 'n4',  severity: 'error',   category: 'system', title: 'MQTT Broker mất kết nối',        description: 'Không thể kết nối tới mqtt.drytech.internal:1883. Kiểm tra hạ tầng mạng.',           timestamp: new Date(Date.now() - 2 * 60_000),     read: false, roles: ['admin'] },
  { id: 'n5',  severity: 'info',    category: 'system', title: 'Cập nhật cấu hình ngưỡng',       description: 'Admin đã cập nhật ngưỡng nhiệt độ tối đa từ 90°C lên 95°C cho Zone A.',              timestamp: new Date(Date.now() - 45 * 60_000),    read: false, roles: ['admin', 'manager'] },
  { id: 'n6',  severity: 'success', category: 'system', title: 'Sao lưu dữ liệu thành công',     description: 'Dữ liệu hệ thống đã được sao lưu lúc 03:00. Kích thước: 248 MB.',                   timestamp: new Date(Date.now() - 6 * 3600_000),   read: true,  roles: ['admin'] },
  { id: 'n7',  severity: 'info',    category: 'system', title: 'Đăng nhập mới',                  description: 'Người dùng "Nguyen Van A" đã đăng nhập từ 192.168.1.42 lúc 07:58.',                  timestamp: new Date(Date.now() - 65 * 60_000),    read: true,  roles: ['admin'] },
  /* ── Mẻ sấy (batch) ── */
  { id: 'n8',  severity: 'success', category: 'batch',  title: 'Mẻ sấy hoàn thành',             description: 'Máy D2 – Công thức "Chuối sấy giòn" đã hoàn thành. 90 kg đạt chuẩn.',               timestamp: new Date(Date.now() - 10 * 60_000),    read: false, roles: ['operator', 'manager'],          zone: 'Zone D' },
  { id: 'n9',  severity: 'success', category: 'batch',  title: 'Mẻ sấy hoàn thành',             description: 'Máy B1 – Công thức "Xoài sấy dẻo" đạt tiến độ 82%. Ước tính hoàn thành trong 28p.', timestamp: new Date(Date.now() - 25 * 60_000),    read: true,  roles: ['operator', 'manager'],          zone: 'Zone B' },
  { id: 'n10', severity: 'info',    category: 'batch',  title: 'Báo cáo tuần sẵn sàng',          description: 'Báo cáo hiệu suất tuần 09/2025 đã được tạo và sẵn sàng để tải xuống.',              timestamp: new Date(Date.now() - 3 * 3600_000),   read: false, roles: ['manager'] },
  { id: 'n11', severity: 'warning', category: 'batch',  title: 'Độ ẩm mẻ sấy bất thường',       description: 'Máy A3 – Độ ẩm 22% cao hơn mức dự kiến theo công thức Dứa sấy dẻo (20%).',          timestamp: new Date(Date.now() - 50 * 60_000),    read: false, roles: ['operator', 'manager'],          zone: 'Zone A' },
];

// ── CRUD helpers ────────────────────────────────────────────────────────────

export function getNotifications(role: string): AppNotification[] {
  const r = role.toLowerCase() as NotifRole;
  return _notifications.filter(n => n.roles.includes(r) || n.roles.includes('all'));
}

export function markAsRead(id: string): void {
  _notifications = _notifications.map(n => n.id === id ? { ...n, read: true } : n);
}

export function markAllAsRead(role: string): void {
  const r = role.toLowerCase() as NotifRole;
  _notifications = _notifications.map(n =>
    (n.roles.includes(r) || n.roles.includes('all')) ? { ...n, read: true } : n,
  );
}

export function clearAllRead(role: string): void {
  const r = role.toLowerCase() as NotifRole;
  _notifications = _notifications.filter(n =>
    !((n.roles.includes(r) || n.roles.includes('all')) && n.read),
  );
}

export function deleteNotification(id: string): void {
  _notifications = _notifications.filter(n => n.id !== id);
}
