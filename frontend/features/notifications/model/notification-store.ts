/**
 * data/notificationData.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * In-memory notification store (module-level singleton).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ApiAlert } from '@/shared/lib/api';

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

let _alertNotifications: AppNotification[] = [];
const _readIds = new Set<string>();
const _deletedIds = new Set<string>();

function toSeverity(type: string | null): NotifSeverity {
  if (type === 'error') return 'error';
  if (type === 'warning') return 'warning';
  if (type === 'success') return 'success';
  return 'info';
}

function toAlertTitle(alert: ApiAlert): string {
  const device = alert.device?.deviceName?.trim();
  if (device) return `Cảnh báo thiết bị ${device}`;
  return 'Cảnh báo hệ thống máy sấy';
}

export function syncAlertNotifications(rows: ApiAlert[]): void {
  _alertNotifications = rows
    .slice()
    .sort((a, b) => {
      const ta = a.alertTime ? new Date(a.alertTime).getTime() : 0;
      const tb = b.alertTime ? new Date(b.alertTime).getTime() : 0;
      return tb - ta;
    })
    .map((row) => {
      const id = `alert-${row.alertID}`;
      const readByStatus = row.alertStatus === 'resolved';
      return {
        id,
        severity: toSeverity(row.alertType),
        category: 'alert' as const,
        title: toAlertTitle(row),
        description: row.alertMessage || 'Có cảnh báo ngưỡng mới phát sinh.',
        timestamp: row.alertTime ? new Date(row.alertTime) : new Date(),
        read: _readIds.has(id) || readByStatus,
        roles: ['admin', 'operator', 'manager'],
      };
    })
    .filter((n) => !_deletedIds.has(n.id));
}

// ── CRUD helpers ────────────────────────────────────────────────────────────

export function getNotifications(role: string): AppNotification[] {
  const r = role.toLowerCase() as NotifRole;
  const merged = [..._alertNotifications, ..._notifications];
  return merged.filter(n => n.roles.includes(r) || n.roles.includes('all'));
}

export function markAsRead(id: string): void {
  _readIds.add(id);
  _notifications = _notifications.map(n => n.id === id ? { ...n, read: true } : n);
  _alertNotifications = _alertNotifications.map(n => n.id === id ? { ...n, read: true } : n);
}

export function markAllAsRead(role: string): void {
  const r = role.toLowerCase() as NotifRole;
  _alertNotifications = _alertNotifications.map(n => {
    if (n.roles.includes(r) || n.roles.includes('all')) {
      _readIds.add(n.id);
      return { ...n, read: true };
    }
    return n;
  });
  _notifications = _notifications.map(n =>
    (n.roles.includes(r) || n.roles.includes('all')) ? { ...n, read: true } : n,
  );
}

export function clearAllRead(role: string): void {
  const r = role.toLowerCase() as NotifRole;
  _alertNotifications
    .filter(n => (n.roles.includes(r) || n.roles.includes('all')) && n.read)
    .forEach(n => _deletedIds.add(n.id));
  _alertNotifications = _alertNotifications.filter(n =>
    !((n.roles.includes(r) || n.roles.includes('all')) && n.read),
  );
  _notifications = _notifications.filter(n =>
    !((n.roles.includes(r) || n.roles.includes('all')) && n.read),
  );
}

export function deleteNotification(id: string): void {
  _deletedIds.add(id);
  _notifications = _notifications.filter(n => n.id !== id);
  _alertNotifications = _alertNotifications.filter(n => n.id !== id);
}
