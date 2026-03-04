"use client";

/**
 * components/layouts/AdminLayout.tsx
 * Layout cho role Admin — sidebar đỏ + MQTT status bar.
 */
import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Layout, Menu, Typography, Avatar, Space, App, Button, Badge, Tooltip,
} from 'antd';
import {
  UserSwitchOutlined, GlobalOutlined, ApiOutlined, SettingOutlined,
  FileTextOutlined, LogoutOutlined, UserOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, WifiOutlined, DisconnectOutlined,
} from '@ant-design/icons';
import NotificationCenter from '@/components/NotificationCenter';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const MENU_ITEMS = [
  { key: '/admin/users',      icon: <UserSwitchOutlined />, label: 'Quản lý Người dùng'    },
  { key: '/admin/zones',      icon: <GlobalOutlined />,     label: 'Quản lý Khu vực'       },
  { key: '/admin/devices',    icon: <ApiOutlined />,        label: 'Cấu hình Thiết bị IoT' },
  { key: '/admin/thresholds', icon: <SettingOutlined />,    label: 'Thiết lập Ngưỡng'      },
  { key: '/admin/logs',       icon: <FileTextOutlined />,   label: 'Nhật ký Hệ thống'      },
];

/** Hook giả lập trạng thái MQTT Broker (thay bằng WebSocket/SSE khi có BE) */
function useMqttStatus() {
  const [connected, setConnected] = useState(true);
  const [latency,   setLatency]   = useState(12);
  useEffect(() => {
    const id = setInterval(() => {
      const ok = Math.random() > 0.04;
      setConnected(ok);
      if (ok) setLatency(Math.round(8 + Math.random() * 18));
    }, 5000);
    return () => clearInterval(id);
  }, []);
  return { connected, latency };
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <App>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </App>
  );
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const user = useMemo<{ name: string; role: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('drytechUser');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }, []);
  const { connected, latency } = useMqttStatus();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'Admin') {
      router.push('/');
    }
  }, [router, user]);

  const selectedKey = MENU_ITEMS.find(item => pathname.startsWith(item.key))?.key || '/admin/users';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed} trigger={null}
        width={236}
        style={{ background: '#001529', position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 200, overflowY: 'auto', overflowX: 'hidden' }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '18px 22px' : '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
          onClick={() => router.push('/admin/users')}
        >
          <div style={{ width: 32, height: 32, background: '#cf1322', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>D</span>
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1.3, overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>DryTech</div>
              <div style={{ color: '#ff7875', fontSize: 10, fontWeight: 700, letterSpacing: 1, whiteSpace: 'nowrap' }}>ADMIN CONSOLE</div>
            </div>
          )}
        </div>
        <Menu
          theme="dark" mode="inline" selectedKeys={[selectedKey]}
          style={{ marginTop: 8, background: 'transparent', border: 'none' }}
          items={MENU_ITEMS.map(item => ({
            key: item.key, icon: item.icon, label: item.label,
            onClick: () => router.push(item.key),
            style: { borderRadius: 7, margin: '2px 8px', width: collapsed ? undefined : 'calc(100% - 16px)' },
          }))}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 236, transition: 'margin 0.2s' }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0', height: 60, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <Space size={14}>
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ color: '#595959', fontSize: 16 }} />
            <Text strong style={{ color: '#001529', fontSize: 15 }}>
              {MENU_ITEMS.find(m => m.key === selectedKey)?.label || 'Admin Console'}
            </Text>
          </Space>

          <Space size={16}>
            {/* MQTT Status */}
            <Tooltip title={connected ? `MQTT Broker: mqtt.drytech.internal:1883 — Độ trễ ${latency}ms` : 'MQTT Broker mất kết nối! Kiểm tra hạ tầng ngay.'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, background: connected ? '#f6ffed' : '#fff2f0', border: `1px solid ${connected ? '#b7eb8f' : '#ffccc7'}`, cursor: 'default' }}>
                {connected
                  ? <WifiOutlined style={{ color: '#52c41a', fontSize: 14 }} />
                  : <DisconnectOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
                }
                <span style={{ fontSize: 12, fontWeight: 600, color: connected ? '#389e0d' : '#cf1322' }}>
                  MQTT {connected ? 'Kết nối' : 'Mất kết nối'}
                </span>
                {connected && <span style={{ fontSize: 11, color: '#8c8c8c' }}>{latency}ms</span>}
                {connected && <Badge status="processing" />}
              </div>
            </Tooltip>

            <Space size={8}>
              <Avatar style={{ background: '#cf1322' }} icon={<UserOutlined />} size={32} />
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#262626' }}>{user?.name || '—'}</div>
                <div style={{ fontSize: 11, color: '#cf1322', fontWeight: 700 }}>Quản trị viên</div>
              </div>
            </Space>

            <NotificationCenter role="admin" accentColor="#cf1322" />

            <Tooltip title="Đăng xuất">
              <Button size="small" danger ghost icon={<LogoutOutlined />} onClick={() => { localStorage.removeItem('drytechUser'); router.push('/login'); }} style={{ borderRadius: 7 }} />
            </Tooltip>
          </Space>
        </Header>

        <Content style={{ padding: '24px', background: '#f4f6f9', minHeight: 'calc(100vh - 60px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
