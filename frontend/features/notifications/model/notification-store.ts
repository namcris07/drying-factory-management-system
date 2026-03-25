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
  { id: 'n1', severity: 'info', category: 'system', title: 'Hệ thống đã đồng bộ backend', description: 'Giao diện đang hiển thị dữ liệu thực từ API cho Zone A.', timestamp: new Date(Date.now() - 12 * 60_000), read: false, roles: ['admin', 'manager', 'operator'] },
  { id: 'n2', severity: 'success', category: 'batch', title: 'Máy A1 sẵn sàng', description: 'Thiết bị Máy sấy A1 đã online và nhận lệnh bình thường.', timestamp: new Date(Date.now() - 5 * 60_000), read: false, roles: ['admin', 'manager', 'operator'], zone: 'Zone A' },
  { id: 'n3', severity: 'info', category: 'system', title: 'Đăng nhập quản trị', description: 'Admin vừa đăng nhập và kiểm tra trạng thái hệ thống.', timestamp: new Date(Date.now() - 40 * 60_000), read: true, roles: ['admin'] },
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
