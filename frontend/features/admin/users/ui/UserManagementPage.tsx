"use client";

/**
 * app/(admin)/admin/users/page.tsx
 * Quản lý người dùng và phân quyền
 */
import { useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Tooltip, Divider, App, Avatar,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined,
  MailOutlined, LockOutlined, CheckCircleOutlined, StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { initialUsers, AppUser, UserRole } from '@/features/admin/model/admin-data';

const { Title, Text } = Typography;

const ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'];
const ROLES: UserRole[] = ['Admin', 'Manager', 'Operator'];

const roleCfg: Record<UserRole, { color: string; bg: string; border: string }> = {
  Admin:    { color: '#cf1322', bg: '#fff0f0', border: '#ffccc7' },
  Manager:  { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
  Operator: { color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' },
};

let nextId = 100;

export default function UserManagementPage() {
  const { message, modal } = App.useApp();
  const [users, setUsers] = useState<AppUser[]>(initialUsers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditingUser(user);
    form.setFieldsValue({ ...user });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingUser) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...values } : u));
        message.success('Đã cập nhật thông tin người dùng.');
      } else {
        const newUser: AppUser = {
          id: `u${++nextId}`,
          ...values,
          status: 'Active',
          createdAt: new Date().toISOString().slice(0, 10),
          lastLogin: '—',
        };
        setUsers(prev => [newUser, ...prev]);
        message.success(`Tài khoản "${newUser.name}" đã được tạo và có hiệu lực ngay.`);
      }
      setModalOpen(false);
    } catch {
      /* validation error */
    }
  };

  const handleDelete = (user: AppUser) => {
    if (user.role === 'Admin') {
      message.error('Không thể xóa tài khoản Admin.');
      return;
    }
    modal.confirm({
      title: `Xóa tài khoản "${user.name}"?`,
      content: 'Hành động này không thể hoàn tác. Lịch sử hoạt động của người dùng vẫn được giữ lại.',
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: () => {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        message.success('Đã xóa tài khoản.');
      },
    });
  };

  const toggleStatus = (user: AppUser) => {
    const next = user.status === 'Active' ? 'Inactive' : 'Active';
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: next } : u));
    message.info(`Tài khoản "${user.name}" → ${next}.`);
  };

  const columns: ColumnsType<AppUser> = [
    {
      title: 'Người dùng',
      key: 'user',
      width: 220,
      render: (_, r) => (
        <Space>
          <Avatar
            style={{ background: roleCfg[r.role].color, flexShrink: 0 }}
            icon={<UserOutlined />}
            size={36}
          />
          <div>
            <Text strong style={{ display: 'block', lineHeight: 1.4 }}>{r.name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <MailOutlined style={{ marginRight: 4 }} />{r.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      width: 110,
      filters: ROLES.map(r => ({ text: r, value: r })),
      onFilter: (val, r) => r.role === val,
      render: (role: UserRole) => (
        <Tag
          style={{
            borderRadius: 12,
            border: `1px solid ${roleCfg[role].border}`,
            background: roleCfg[role].bg,
            color: roleCfg[role].color,
            fontWeight: 700,
            padding: '2px 10px',
          }}
        >
          {role}
        </Tag>
      ),
    },
    {
      title: 'Khu vực phụ trách',
      dataIndex: 'zones',
      render: (zones: string[]) =>
        zones.length === 0
          ? <Text type="secondary" style={{ fontSize: 12 }}>Tất cả (Admin)</Text>
          : zones.map(z => <Tag key={z} color="blue" style={{ borderRadius: 10, margin: '2px 3px 2px 0' }}>{z}</Tag>),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 110,
      filters: [{ text: 'Active', value: 'Active' }, { text: 'Inactive', value: 'Inactive' }],
      onFilter: (val, r) => r.status === val,
      render: (status, record) => (
        <Tooltip title={`Nhấn để ${status === 'Active' ? 'vô hiệu hóa' : 'kích hoạt'}`}>
          <Tag
            color={status === 'Active' ? 'success' : 'default'}
            style={{ cursor: 'pointer', borderRadius: 12, padding: '2px 10px' }}
            onClick={() => toggleStatus(record)}
            icon={status === 'Active' ? <CheckCircleOutlined /> : <StopOutlined />}
          >
            {status}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Đăng nhập cuối',
      dataIndex: 'lastLogin',
      width: 160,
      render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 110,
      render: (_, record) => (
        <Space>
          <Tooltip title="Chỉnh sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} style={{ borderRadius: 7 }} />
          </Tooltip>
          <Tooltip title="Xóa tài khoản">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              style={{ borderRadius: 7 }}
              disabled={record.role === 'Admin'}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <UserOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            Quản lý Người dùng & Phân quyền
          </Title>
        </div>
        <Space>
          <Input.Search
            placeholder="Tìm theo tên, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 8 }}>
            Thêm người dùng
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        {ROLES.map(role => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div
              key={role}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: `1px solid ${roleCfg[role].border}`,
                background: roleCfg[role].bg,
                minWidth: 110,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 800, color: roleCfg[role].color }}>{count}</div>
              <div style={{ fontSize: 12, color: '#595959' }}>{role}</div>
            </div>
          );
        })}
        <div
          style={{
            padding: '10px 20px',
            borderRadius: 12,
            border: '1px solid #f0f0f0',
            background: '#fafafa',
            minWidth: 110,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: '#8c8c8c' }}>
            {users.filter(u => u.status === 'Inactive').length}
          </div>
          <div style={{ fontSize: 12, color: '#595959' }}>Inactive</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowClassName={r => r.status === 'Inactive' ? 'opacity-50' : ''}
          style={{ borderRadius: 14 }}
        />
      </div>

      {/* Modal */}
      <Modal
        title={
          <Space>
            <UserOutlined style={{ color: '#1677ff' }} />
            {editingUser ? `Chỉnh sửa: ${editingUser.name}` : 'Thêm người dùng mới'}
          </Space>
        }
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
        cancelText="Hủy"
        forceRender
        width={520}
        destroyOnClose
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 } }}
      >
        <Divider style={{ margin: '12px 0 20px' }} />
        <Form form={form} layout="vertical" size="large">
          <Form.Item name="name" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên!' }]}>
            <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn A" />
          </Form.Item>
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
          {!editingUser && (
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }, { min: 6, message: 'Tối thiểu 6 ký tự' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
            </Form.Item>
          )}
          <Form.Item name="role" label="Vai trò" rules={[{ required: true, message: 'Chọn vai trò!' }]}>
            <Select
              placeholder="Chọn vai trò..."
              options={ROLES.map(r => ({
                value: r,
                label: (
                  <Space>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: roleCfg[r].color,
                      }}
                    />
                    {r}
                  </Space>
                ),
              }))}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.role !== cur.role}
          >
            {({ getFieldValue }) =>
              getFieldValue('role') !== 'Admin' ? (
                <Form.Item name="zones" label="Khu vực phụ trách" rules={[{ required: true, message: 'Chọn ít nhất 1 Zone!' }]}>
                  <Select mode="multiple" placeholder="Chọn khu vực..." options={ZONES.map(z => ({ value: z, label: z }))} />
                </Form.Item>
              ) : (
                <div style={{ padding: '8px 12px', background: '#fff0f0', borderRadius: 8, marginBottom: 16 }}>
                  <Text style={{ color: '#cf1322', fontSize: 13 }}>
                    ⚠️ Admin có quyền truy cập toàn hệ thống, không cần giới hạn Zone.
                  </Text>
                </div>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
