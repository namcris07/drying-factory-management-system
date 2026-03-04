"use client";

/**
 * components/NotificationCenter.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Trung tâm thông báo — dùng chung cho tất cả roles.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useState, useMemo, useSyncExternalStore } from 'react';
import {
  Drawer, Badge, Button, Tabs, Typography, Space, Empty,
  Tag, Tooltip,
} from 'antd';
import {
  BellOutlined, CheckOutlined, DeleteOutlined, CloseOutlined,
  WarningOutlined, CheckCircleOutlined, InfoCircleOutlined,
  CloseCircleOutlined, FilterOutlined, BellFilled,
} from '@ant-design/icons';
import {
  AppNotification,
  getNotifications, markAsRead, markAllAsRead,
  clearAllRead, deleteNotification,
} from '@/data/notificationData';

const { Text } = Typography;
type TagColor = NonNullable<React.ComponentProps<typeof Tag>['color']>;

function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return 'Vừa xong';
  if (diff < 3600)  return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

const SEVERITY_CONFIG: Record<
  AppNotification['severity'],
  { icon: React.ReactNode; color: string; bg: string; border: string; tagColor: TagColor; label: string }
> = {
  error:   { icon: <CloseCircleOutlined />, color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7', tagColor: 'error',   label: 'Lỗi'       },
  warning: { icon: <WarningOutlined />,     color: '#faad14', bg: '#fffbe6', border: '#ffe58f', tagColor: 'warning', label: 'Cảnh báo'  },
  info:    { icon: <InfoCircleOutlined />,  color: '#1677ff', bg: '#e6f4ff', border: '#91caff', tagColor: 'blue',    label: 'Thông tin' },
  success: { icon: <CheckCircleOutlined />, color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', tagColor: 'success', label: 'Thành công'},
};

function NotificationItem({
  notif, onRead, onDelete, hydrated,
}: {
  notif: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  hydrated: boolean;
}) {
  const s = SEVERITY_CONFIG[notif.severity];
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 7,
      background: notif.read ? '#fafafa' : '#fff',
      border: `1px solid ${notif.read ? '#f0f0f0' : s.border}`,
      marginBottom: 8, position: 'relative',
      transition: 'all 0.2s', opacity: notif.read ? 0.75 : 1,
    }}>
      {!notif.read && (
        <div style={{ position: 'absolute', top: 12, right: 12, width: 8, height: 8, borderRadius: '50%', background: s.color }} />
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', paddingRight: notif.read ? 0 : 16 }}>
        <div style={{ width: 34, height: 34, borderRadius: 7, background: s.bg, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, color: s.color }}>
          {s.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 13, color: '#262626' }}>{notif.title}</Text>
            <Tag color={s.tagColor} style={{ borderRadius: 20, fontSize: 10, padding: '0 6px', lineHeight: '18px', border: 'none', margin: 0 }}>{s.label}</Tag>
            {notif.zone && (
              <Tag style={{ borderRadius: 20, fontSize: 10, padding: '0 6px', lineHeight: '18px', margin: 0, background: '#f5f5f5', border: 'none', color: '#595959' }}>{notif.zone}</Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{notif.description}</Text>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>{hydrated ? relativeTime(notif.timestamp) : '...'}</Text>
            <Space size={4}>
              {!notif.read && (
                <Tooltip title="Đánh dấu đã đọc">
                  <Button type="text" size="small" icon={<CheckOutlined />} onClick={() => onRead(notif.id)} style={{ color: '#52c41a', fontSize: 11, height: 22, padding: '0 6px' }} />
                </Tooltip>
              )}
              <Tooltip title="Xóa">
                <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => onDelete(notif.id)} style={{ color: '#bfbfbf', fontSize: 11, height: 22, padding: '0 6px' }} danger />
              </Tooltip>
            </Space>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface NotificationCenterProps {
  role: string;
  accentColor?: string;
}

export default function NotificationCenter({ role, accentColor = '#1677ff' }: NotificationCenterProps) {
  const [open, setOpen]           = useState(false);
  const [tick, setTick]           = useState(0);
  const [activeTab, setActiveTab] = useState<string>('all');
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const refresh = () => setTick(t => t + 1);

  const allNotifs    = useMemo(() => getNotifications(role), [role, tick]); // eslint-disable-line
  const unreadCount  = allNotifs.filter(n => !n.read).length;
  const filtered     = useMemo(() => activeTab === 'all' ? allNotifs : allNotifs.filter(n => n.category === activeTab), [allNotifs, activeTab]);
  const unreadInTab  = filtered.filter(n => !n.read).length;

  const handleRead      = (id: string)  => { markAsRead(id); refresh(); };
  const handleDelete    = (id: string)  => { deleteNotification(id); refresh(); };
  const handleMarkAll   = ()            => { markAllAsRead(role); refresh(); };
  const handleClearRead = ()            => { clearAllRead(role); refresh(); };

  const tabItems = [
    { key: 'all',    label: `Tất cả (${allNotifs.length})` },
    { key: 'alert',  label: `Cảnh báo (${allNotifs.filter(n => n.category === 'alert').length})` },
    { key: 'system', label: `Hệ thống (${allNotifs.filter(n => n.category === 'system').length})` },
    { key: 'batch',  label: `Mẻ sấy (${allNotifs.filter(n => n.category === 'batch').length})` },
  ];

  return (
    <>
      <Tooltip title="Trung tâm thông báo">
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={unreadCount > 0
              ? <BellFilled style={{ fontSize: 18, color: accentColor }} />
              : <BellOutlined style={{ fontSize: 18, color: '#595959' }} />
            }
            onClick={() => setOpen(true)}
            style={{ borderRadius: 7 }}
          />
        </Badge>
      </Tooltip>

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellFilled style={{ color: accentColor, fontSize: 16 }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>Trung tâm Thông báo</span>
            {unreadCount > 0 && (
              <Tag color="red" style={{ borderRadius: 20, fontSize: 11, padding: '0 7px', lineHeight: '20px', border: 'none', marginLeft: 2 }}>
                {unreadCount} chưa đọc
              </Tag>
            )}
          </div>
        }
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        closeIcon={<CloseOutlined />}
        styles={{
          wrapper: { width: 420 },
          body:    { padding: '0', display: 'flex', flexDirection: 'column', height: '100%' },
          header:  { borderBottom: '1px solid #f0f0f0', padding: '14px 16px' },
        }}
        extra={<Tooltip title="Lọc danh mục"><Button type="text" size="small" icon={<FilterOutlined />} style={{ color: '#8c8c8c' }} /></Tooltip>}
      >
        {/* Action bar */}
        <div style={{ padding: '10px 16px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
          </Text>
          <Space size={6}>
            {unreadCount > 0 && (
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleMarkAll} style={{ fontSize: 12, padding: '0 4px' }}>
                Đọc tất cả
              </Button>
            )}
            <span style={{ display: 'inline-block', width: 1, height: 14, background: '#e8e8e8', margin: '0 4px', verticalAlign: 'middle' }} />
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={handleClearRead} style={{ fontSize: 12, padding: '0 4px' }}>
              Xóa đã đọc
            </Button>
          </Space>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="small" items={tabItems} style={{ marginBottom: 0 }} />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {filtered.length === 0 ? (
            <div style={{ paddingTop: 48 }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={
                <Space direction="vertical" size={4} style={{ textAlign: 'center' }}>
                  <Text style={{ color: '#8c8c8c' }}>Không có thông báo nào</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>Thông báo mới sẽ xuất hiện ở đây</Text>
                </Space>
              } />
            </div>
          ) : (
            <>
              {unreadInTab > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 3, height: 14, background: '#ff4d4f', borderRadius: 2 }} />
                    <Text style={{ fontSize: 11, fontWeight: 600, color: '#ff4d4f', letterSpacing: 0.5, textTransform: 'uppercase' }}>Chưa đọc</Text>
                  </div>
                  {filtered.filter(n => !n.read).map(n => (
                    <NotificationItem key={n.id} notif={n} onRead={handleRead} onDelete={handleDelete} hydrated={hydrated} />
                  ))}
                </>
              )}
              {filtered.some(n => n.read) && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0 8px' }}>
                    <div style={{ width: 3, height: 14, background: '#d9d9d9', borderRadius: 2 }} />
                    <Text style={{ fontSize: 11, fontWeight: 600, color: '#bfbfbf', letterSpacing: 0.5, textTransform: 'uppercase' }}>Đã đọc</Text>
                  </div>
                  {filtered.filter(n => n.read).map(n => (
                    <NotificationItem key={n.id} notif={n} onRead={handleRead} onDelete={handleDelete} hydrated={hydrated} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>Cập nhật theo thời gian thực · DryTech v2.0</Text>
        </div>
      </Drawer>
    </>
  );
}
