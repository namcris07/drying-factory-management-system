"use client";

/**
 * components/layouts/OperatorLayout.tsx
 * Layout cho role Operator — sidebar xanh lá + real-time simulation.
 */
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Badge, Button, Avatar, Typography, Space, App, Menu } from 'antd';
import {
  LogoutOutlined, UserOutlined,
  AppstoreOutlined, DesktopOutlined,
  AlertOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { OperatorProvider, useOperatorContext } from '@/contexts/OperatorContext';
import NotificationCenter from '@/components/NotificationCenter';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

// Menu Items
const MENU_ITEMS = [
  { key: '/operator',           icon: <AppstoreOutlined />,    label: 'Dashboard Khu vực'       },
  { key: '/operator/realtime',  icon: <DesktopOutlined />,     label: 'Giám sát Thời gian thực' },
  { key: '/operator/adafruit',  icon: <CloudServerOutlined />, label: 'Adafruit IO'              },
  { key: '/operator/alerts',    icon: <AlertOutlined />,       label: 'Xử lý Cảnh báo'          },
];

interface OperatorLayoutProps {
  children: React.ReactNode;
}

export default function OperatorLayout({ children }: OperatorLayoutProps) {
  const [user, setUser] = useState<{ name: string; role: string; zone: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('drytechUser');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  const zone = user?.zone || 'Zone A';
  const operatorName = user?.name || '';

  return (
    <App>
      <OperatorProvider zone={zone} operatorName={operatorName}>
        <OperatorLayoutInner user={user}>{children}</OperatorLayoutInner>
      </OperatorProvider>
    </App>
  );
}

interface OperatorLayoutInnerProps {
  children: React.ReactNode;
  user: { name: string; role: string; zone: string } | null;
}

function OperatorLayoutInner({ children, user }: OperatorLayoutInnerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { machines, zone } = useOperatorContext();

  const handleLogout = () => {
    localStorage.removeItem('drytechUser');
    router.push('/login');
  };

  const selectedKey = MENU_ITEMS.find(item => pathname === item.key)?.key
    || (pathname.startsWith('/operator/machine') ? '' : '/operator');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed} trigger={null}
        width={216}
        style={{ background: '#0a1628', position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 200, overflowY: 'auto' }}
      >
        {/* Logo */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '18px 22px' : '18px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}
          onClick={() => router.push('/operator')}
        >
          <div style={{ width: 32, height: 32, background: '#52c41a', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>D</span>
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1.3, overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>DryTech</div>
              <div style={{ color: '#95de64', fontSize: 10, fontWeight: 700, letterSpacing: 0.9, whiteSpace: 'nowrap' }}>VẬN HÀNH — {zone}</div>
            </div>
          )}
        </div>

        {/* Main Menu */}
        <Menu
          theme="dark" mode="inline" selectedKeys={[selectedKey]}
          style={{ marginTop: 10, background: 'transparent', border: 'none' }}
          items={MENU_ITEMS.map(item => ({
            key: item.key, icon: item.icon, label: item.label,
            onClick: () => router.push(item.key),
            style: { borderRadius: 7, margin: '2px 8px', width: collapsed ? undefined : 'calc(100% - 16px)' },
          }))}
        />

        {/* Machine quick-nav */}
        {!collapsed && (
          <>
            <div style={{ padding: '10px 16px 4px', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Điều khiển máy
            </div>
            {machines.filter(m => m.zone === zone).map(m => {
              const colorMap: Record<string, string> = { Running: '#52c41a', Error: '#ff4d4f', Idle: '#8c8c8c', Maintenance: '#faad14' };
              return (
                <div
                  key={m.id}
                  onClick={() => router.push(`/operator/machine/${m.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 16px', cursor: 'pointer',
                    color: pathname === `/operator/machine/${m.id}` ? '#fff' : 'rgba(255,255,255,0.55)',
                    background: pathname === `/operator/machine/${m.id}` ? 'rgba(82,196,26,0.12)' : 'transparent',
                    borderLeft: pathname === `/operator/machine/${m.id}` ? '3px solid #52c41a' : '3px solid transparent',
                    transition: 'all 0.15s', fontSize: 13,
                  }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: colorMap[m.status], flexShrink: 0 }} />
                  <span>{m.name}</span>
                  <Badge count={m.status === 'Error' ? '!' : 0} size="small" style={{ background: '#ff4d4f', marginLeft: 'auto' }} />
                </div>
              );
            })}
          </>
        )}
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 216, transition: 'margin 0.2s' }}>
        <Header style={{ background: 'linear-gradient(90deg, #0a1628 0%, #003a8c 100%)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.35)' }}>
          <Space size={10}>
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }} />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>|</Text>
            <Text style={{ color: '#95de64', fontWeight: 700, fontSize: 14 }}>
              {MENU_ITEMS.find(m => m.key === selectedKey)?.label || 'Điều khiển Máy'}
            </Text>
          </Space>
          <Space size={12}>
            <NotificationCenter role="operator" accentColor="#52c41a" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Avatar style={{ background: '#52c41a', flexShrink: 0 }} icon={<UserOutlined />} size={30} />
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{user?.name || '—'}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>Vận hành · {zone}</div>
              </div>
            </div>
            <Button size="small" danger ghost icon={<LogoutOutlined />} onClick={handleLogout} style={{ borderRadius: 7 }}>Thoát</Button>
          </Space>
        </Header>

        <Content style={{ padding: '20px', background: '#f0f2f5', minHeight: 'calc(100vh - 56px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
