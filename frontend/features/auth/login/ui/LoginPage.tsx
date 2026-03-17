"use client";

/**
 * app/(auth)/login/page.tsx
 * Trang đăng nhập hệ thống
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Typography, Divider, Alert, Tag } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { UserRole, roleHomePath, setAuthSession } from '@/shared/auth/session';
import { authApi } from '@/shared/lib/api';

const { Title, Text } = Typography;

type DemoAccount = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  zone: string;
  label: string;
  color: 'red' | 'blue' | 'success';
};

const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'admin@drytech.io',   password: 'admin123', name: 'Super Admin',   role: 'Admin',    zone: 'All Zones', label: 'Quản trị hệ thống', color: 'red'     },
  { email: 'manager@drytech.io', password: '123456',   name: 'Alex Morgan',   role: 'Manager',  zone: 'All Zones', label: 'Quản lý nhà máy',   color: 'blue'    },
  { email: 'op_a@drytech.io',    password: 'op123',    name: 'Nguyễn Văn An', role: 'Operator', zone: 'Zone A',    label: 'Vận hành Zone A',   color: 'success' },
  { email: 'op_b@drytech.io',    password: 'op123',    name: 'Trần Thị Bình', role: 'Operator', zone: 'Zone B',    label: 'Vận hành Zone B',   color: 'success' },
  { email: 'op_c@drytech.io',    password: 'op123',    name: 'Lê Văn Cường',  role: 'Operator', zone: 'Zone C',    label: 'Vận hành Zone C',   color: 'success' },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError('');
    try {
      const user = await authApi.login(values.email, values.password);
      setAuthSession({ name: user.name, role: user.role as UserRole, zone: user.zone });
      router.push(roleHomePath(user.role as UserRole));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng thử lại.';
      setError(msg);
      setLoading(false);
    }
  };

  const fillAccount = (acc: DemoAccount) => {
    form.setFieldsValue({ email: acc.email, password: acc.password });
    setError('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #001529 0%, #003a8c 55%, #1677ff 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '12px 28px',
              marginBottom: 16,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                background: '#1677ff',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ color: '#fff', fontSize: 20, fontWeight: 900 }}>D</span>
            </div>
            <span style={{ color: '#fff', fontSize: 26, fontWeight: 800 }}>DryTech</span>
          </div>
          <div>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
              Hệ thống Quản lý Sấy Công nghiệp
            </Text>
          </div>
        </div>

        {/* Login Card */}
        <Card
          style={{ borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
          styles={{ body: { padding: '36px 40px' } }}
        >
          <Title level={3} style={{ textAlign: 'center', marginBottom: 6, color: '#001529' }}>
            Đăng nhập hệ thống
          </Title>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 28 }}>
            Nhập tài khoản được cấp để tiếp tục
          </Text>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ marginBottom: 20, borderRadius: 7 }}
            />
          )}

          <Form form={form} layout="vertical" onFinish={handleLogin} size="large">
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Vui lòng nhập email!' },
                { type: 'email', message: 'Email không hợp lệ!' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="email@drytech.io" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="••••••" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                style={{ height: 48, borderRadius: 7, fontSize: 15, fontWeight: 700 }}
              >
                Đăng nhập
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: '16px 0 14px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Tài khoản demo — nhấn để điền</Text>
          </Divider>

          {/* Demo accounts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_ACCOUNTS.map(acc => (
              <div
                key={acc.email}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#f8f9fa',
                  borderRadius: 7,
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onClick={() => fillAccount(acc)}
                onMouseEnter={e => (e.currentTarget.style.background = '#eef2f7')}
                onMouseLeave={e => (e.currentTarget.style.background = '#f8f9fa')}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#262626' }}>{acc.label}</div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', fontFamily: 'monospace' }}>
                    {acc.email} / {acc.password}
                  </div>
                </div>
                <Tag color={acc.color as "red" | "blue" | "success"} style={{ borderRadius: 10, fontSize: 11, margin: 0 }}>
                  {acc.zone}
                </Tag>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            © 2024 DryTech Industrial Systems. All rights reserved.
          </Text>
        </div>
      </div>
    </div>
  );
}
