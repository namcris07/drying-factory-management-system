import { describe, expect, it, vi } from 'vitest';

describe('notification-store', () => {
  async function loadStore() {
    vi.resetModules();
    return import('@/features/notifications/model/notification-store');
  }

  it('normal: getNotifications filters by role', async () => {
    const store = await loadStore();

    const managerNotifs = store.getNotifications('manager');

    expect(managerNotifs.length).toBeGreaterThan(0);
    expect(managerNotifs.every((n) => n.roles.includes('manager') || n.roles.includes('all'))).toBe(true);
  });

  it('edge: markAllAsRead and clearAllRead only affect selected role scope', async () => {
    const store = await loadStore();

    store.markAllAsRead('operator');
    const operatorNotifs = store.getNotifications('operator');
    expect(operatorNotifs.every((n) => n.read)).toBe(true);

    store.clearAllRead('operator');
    const afterClear = store.getNotifications('operator');
    expect(afterClear.length).toBe(0);

    const adminNotifs = store.getNotifications('admin');
    expect(adminNotifs.length).toBeGreaterThan(0);
  });

  it('error: deleteNotification with unknown id is safe', async () => {
    const store = await loadStore();

    const before = store.getNotifications('admin').length;
    expect(() => store.deleteNotification('not-found')).not.toThrow();
    const after = store.getNotifications('admin').length;

    expect(after).toBe(before);
  });
});
