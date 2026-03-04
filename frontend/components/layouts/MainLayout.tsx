"use client";

/**
 * components/layouts/MainLayout.tsx
 * Layout cho role Manager — sidebar + header + content area.
 */
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Layout, Menu, Avatar, Typography, Button,
  Dropdown, Space, App,
} from 'antd';
import {
  DashboardOutlined, BookOutlined, HistoryOutlined,
  FileTextOutlined, BarChartOutlined, UserOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import NotificationCenter from '@/components/NotificationCenter';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const MENU_ITEMS = [
  {
    key: 'main',
    type: 'group' as const,
    label: <span style={{ fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Quản lý & Phân tích</span>,
    children: [
      { key: '/manager', icon: <DashboardOutlined />, label: 'Dashboard KPI'        },
      { key: '/recipes', icon: <BookOutlined />,      label: 'Thư viện Công thức'   },
      { key: '/batches', icon: <HistoryOutlined />,   label: 'Lịch sử Mẻ sấy'      },
      { key: '/reports', icon: <FileTextOutlined />,  label: 'Xuất Báo cáo'         },
      { key: '/ai',      icon: <BarChartOutlined />,  label: 'Phân tích Hiệu suất'  },
      { key: '/ui',      icon: <AppstoreOutlined />,  label: 'Thư viện Components'  },
    ],
  },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <App>
      <MainLayoutInner>{children}</MainLayoutInner>
    </App>
  );
}

function MainLayoutInner({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ name: string; role: string; zone?: string } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('drytechUser');
    if (!stored) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('drytechUser');
    router.push('/login');
  };

  const userMenuItems = [
    { key: 'profile', icon: <UserOutlined />,   label: 'Hồ sơ cá nhân' },
    { type: 'divider' as const },
    { key: 'logout',  icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: handleLogout },
  ];

  const selectedKey  = pathname === '/' ? '/manager' : pathname;
  const currentLabel = MENU_ITEMS[0].children.find(m => m.key === selectedKey)?.label || 'Dashboard KPI';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed} trigger={null}
        width={220}
        style={{ background: '#001529', boxShadow: '2px 0 8px rgba(0,0,0,0.15)', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100, overflow: 'auto' }}
      >
        <div
          style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '0' : '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 10, cursor: 'pointer' }}
          onClick={() => router.push('/manager')}
        >
          <div style={{ width: 32, height: 32, background: '#1677ff', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 900 }}>D</span>
          </div>
          {!collapsed && (
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>DryTech</div>
              <div style={{ color: '#69b1ff', fontSize: 10, fontWeight: 600, letterSpacing: 0.8 }}>MANAGER</div>
            </div>
          )}
        </div>
        <Menu
          theme="dark" mode="inline" selectedKeys={[selectedKey]}
          items={MENU_ITEMS} onClick={({ key }) => router.push(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'all 0.2s' }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 99, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: 64 }}>
          <Space size={14}>
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ fontSize: 17, color: '#595959' }} />
            <Text strong style={{ color: '#001529', fontSize: 15 }}>{currentLabel}</Text>
          </Space>
          <Space size={14}>
            <NotificationCenter role="manager" accentColor="#1677ff" />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <Space style={{ cursor: 'pointer', padding: '4px 10px', borderRadius: 7, border: '1px solid #f0f0f0' }}>
                <Avatar style={{ background: '#1677ff' }} icon={<UserOutlined />} size={32} />
                <div style={{ lineHeight: 1.3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#262626' }}>{user?.name || 'Manager'}</div>
                  <div style={{ fontSize: 11, color: '#1677ff', fontWeight: 600 }}>{user?.role || 'Manager'}</div>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ padding: '24px', background: '#f4f6f9', minHeight: 'calc(100vh - 64px)' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
