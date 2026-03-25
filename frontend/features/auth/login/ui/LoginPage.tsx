"use client";

/**
 * app/(auth)/login/page.tsx
 * Trang đăng nhập hệ thống
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { UserRole, roleHomePath, setAuthSession } from '@/shared/auth/session';
import { authApi } from '@/shared/lib/api';

const { Title, Text } = Typography;

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
