"use client";

/**
 * app/(admin)/admin/users/page.tsx
 * Quản lý người dùng và phân quyền — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, Tooltip, Divider, App, Avatar, Spin,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined,
  MailOutlined, LockOutlined, CheckCircleOutlined, StopOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { usersApi, ApiUser, zonesApi, ApiZone } from '@/shared/lib/api';

const { Title, Text } = Typography;

type UserRole = 'Admin' | 'Manager' | 'Operator';
const ROLES: UserRole[] = ['Admin', 'Manager', 'Operator'];

const roleCfg: Record<UserRole, { color: string; bg: string; border: string }> = {
  Admin:    { color: '#cf1322', bg: '#fff0f0', border: '#ffccc7' },
  Manager:  { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
  Operator: { color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' },
};

function displayName(u: ApiUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '—';
}

export default function UserManagementPage() {
  const { message, modal } = App.useApp();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [zones, setZones] = useState<ApiZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const selectedRole = Form.useWatch('role', form) as UserRole | undefined;
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');

  const loadUsers = async () => {
    try {
      const [data, zoneRows] = await Promise.all([
        usersApi.getAll(),
        zonesApi.getAll(),
      ]);
      setUsers(data);
      setZones(zoneRows);
    } catch {
      message.error('Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = users.filter(u => {
    const name = displayName(u).toLowerCase();
    const email = (u.email ?? '').toLowerCase();
    const q = search.toLowerCase();

    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;

    return name.includes(q) || email.includes(q);
  });

  const clearFilters = () => {
    setSearch('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (user: ApiUser) => {
    setEditingUser(user);
    form.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      zoneIDs: user.zones?.map((z) => z.zoneID) ?? [],
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        // Backend đang dùng field chamberIDs cho danh sách zone gán operator.
        chamberIDs:
          values.role === 'Operator'
            ? (Array.isArray(values.zoneIDs) ? values.zoneIDs : [])
            : [],
      };

      if (editingUser) {
        await usersApi.update(editingUser.userID, payload);
        message.success('Đã cập nhật thông tin người dùng.');
      } else {
        await usersApi.create(payload);
        message.success(`Tài khoản đã được tạo.`);
      }
      setModalOpen(false);
      await loadUsers();
    } catch {
      // validation or API error — message already shown or form shows inline
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (user: ApiUser) => {
    if (user.role === 'Admin') {
      message.error('Không thể xóa tài khoản Admin.');
      return;
    }
    modal.confirm({
      title: `Xóa tài khoản "${displayName(user)}"?`,
      content: 'Hành động này không thể hoàn tác.',
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await usersApi.remove(user.userID);
          message.success('Đã xóa tài khoản.');
          await loadUsers();
        } catch {
          message.error('Xóa tài khoản thất bại.');
        }
      },
    });
  };

  const toggleStatus = async (user: ApiUser) => {
    const next = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await usersApi.update(user.userID, { status: next });
      message.info(`Tài khoản "${displayName(user)}" → ${next}.`);
      await loadUsers();
    } catch {
      message.error('Cập nhật trạng thái thất bại.');
    }
  };

  const columns: ColumnsType<ApiUser> = [
    {
      title: 'Người dùng',
      key: 'user',
      width: 220,
      render: (_, r) => (
        <Space>
          <Avatar
            style={{ background: roleCfg[(r.role as UserRole) ?? 'Operator']?.color ?? '#1677ff', flexShrink: 0 }}
            icon={<UserOutlined />}
            size={36}
          />
          <div>
            <Text strong style={{ display: 'block', lineHeight: 1.4 }}>{displayName(r)}</Text>
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
      render: (role: string) => {
        const cfg = roleCfg[role as UserRole] ?? { color: '#595959', bg: '#fafafa', border: '#f0f0f0' };
        return (
          <Tag
            style={{
              borderRadius: 12,
              border: `1px solid ${cfg.border}`,
              background: cfg.bg,
              color: cfg.color,
              fontWeight: 700,
              padding: '2px 10px',
            }}
          >
            {role}
          </Tag>
        );
      },
    },
    {
      title: 'Zone phụ trách',
      key: 'zones',
      render: (_, r) => {
        const zones = r.zones ?? [];
        return zones.length === 0
          ? <Text type="secondary" style={{ fontSize: 12 }}>{r.role === 'Operator' ? 'Chưa gán zone' : 'Toàn nhà máy'}</Text>
          : zones.map(z => (
              <Tag key={z.zoneID} color="blue" style={{ borderRadius: 10, margin: '2px 3px 2px 0' }}>
                {z.zoneName}
              </Tag>
            ));
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 110,
      filters: [{ text: 'Active', value: 'Active' }, { text: 'Inactive', value: 'Inactive' }],
      onFilter: (val, r) => r.status === val,
      render: (status: string, record) => (
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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

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
          <Select
            value={roleFilter}
            onChange={(value) => setRoleFilter(value)}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: 'Tất cả vai trò' },
              ...ROLES.map((role) => ({ value: role, label: role })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
          />
          <Button onClick={clearFilters}>Xóa lọc</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 8 }}>
            Thêm người dùng
          </Button>
        </Space>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
        Hiển thị {filtered.length}/{users.length} người dùng
      </Text>

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
          rowKey="userID"
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
            {editingUser ? `Chỉnh sửa: ${displayName(editingUser)}` : 'Thêm người dùng mới'}
          </Space>
        }
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
        cancelText="Hủy"
        confirmLoading={saving}
        forceRender
        width={520}
        destroyOnClose
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 } }}
      >
        <Divider style={{ margin: '12px 0 20px' }} />
        <Form form={form} layout="vertical" size="large">
          <Form.Item name="firstName" label="Họ và tên đệm" rules={[{ required: true, message: 'Bắt buộc!' }]}>
            <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn" />
          </Form.Item>
          <Form.Item name="lastName" label="Tên" rules={[{ required: true, message: 'Bắt buộc!' }]}>
            <Input placeholder="An" />
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
              options={ROLES.map(r => ({ value: r, label: r }))}
            />
          </Form.Item>
          {selectedRole === 'Operator' ? (
            <Form.Item
              name="zoneIDs"
              label="Zone phụ trách"
              rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất 1 zone cho Operator.' }]}
            >
              <Select
                mode="multiple"
                placeholder="Chọn zone cho Operator"
                options={zones.map((zone) => ({
                  value: zone.zoneID,
                  label: zone.zoneName || `Zone ${zone.zoneID}`,
                }))}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
