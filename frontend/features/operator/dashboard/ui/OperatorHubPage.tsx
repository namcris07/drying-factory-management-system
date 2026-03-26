"use client";

/**
 * app/(operator)/operator/page.tsx
 * Operator Hub - Dashboard khu vực cho Operator
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Row,
  Col,
  Tag,
  Typography,
  Button,
  Progress,
  Space,
  Modal,
  Radio,
  App,
  Badge,
  Tooltip,
} from 'antd';
import {
  ThunderboltOutlined,
  PauseCircleOutlined,
  WarningOutlined,
  ToolOutlined,
  PlayCircleOutlined,
  BookOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useOperatorContext } from '@/features/operator/model/operator-context';
import { Machine, Recipe } from '@/features/operator/model/machine-data';
import { OperatingModeToggle } from './OperatingModeToggle';

const { Title, Text } = Typography;

type StatusKey = 'Running' | 'Idle' | 'Error' | 'Maintenance';

const statusCfg: Record<StatusKey, { color: string; bg: string; border: string; headerBg: string; text: string; tagColor: 'success' | 'default' | 'error' | 'warning' }> = {
  Running: { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', headerBg: 'rgba(82,196,26,0.07)', text: 'Đang chạy', tagColor: 'success' },
  Idle:    { color: '#8c8c8c', bg: '#fafafa', border: '#e8e8e8', headerBg: 'rgba(140,140,140,0.05)', text: 'Chờ',       tagColor: 'default' },
  Error:   { color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7', headerBg: 'rgba(255,77,79,0.08)',  text: 'Lỗi',       tagColor: 'error'   },
  Maintenance: { color: '#faad14', bg: '#fffbe6', border: '#ffe58f', headerBg: 'rgba(250,173,20,0.07)', text: 'Bảo trì', tagColor: 'warning' },
};

export default function OperatorHubPage() {
  const router = useRouter();
  const { machines, setMachines, zone, recipes } = useOperatorContext();
  const { message: messageApi } = App.useApp();
  const [quickStartMachine, setQuickStartMachine] = useState<Machine | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const zoneMachines = machines.filter(m => m.zone === zone);
  const counts = {
    running: zoneMachines.filter(m => m.status === 'Running').length,
    idle: zoneMachines.filter(m => m.status === 'Idle').length,
    error: zoneMachines.filter(m => m.status === 'Error').length,
    maintenance: zoneMachines.filter(m => m.status === 'Maintenance').length,
  };

  const handleQuickStart = () => {
    if (!selectedRecipe || !quickStartMachine) {
      messageApi.warning('Vui lòng chọn công thức!');
      return;
    }
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setMachines(prev =>
      prev.map(m =>
        m.id === quickStartMachine.id
          ? {
              ...m,
              status: 'Running' as const,
              recipe: selectedRecipe.name,
              recipeId: selectedRecipe.id,
              progress: 0,
              temp: selectedRecipe.temp,
              humidity: selectedRecipe.humidity + 15,
              startTime: timeStr,
              doorOpen: false,
            }
          : m
      )
    );
    messageApi.success(`🚀 Đã khởi động ${quickStartMachine.name} với công thức "${selectedRecipe.name}"!`);
    setQuickStartMachine(null);
    setSelectedRecipe(null);
  };

  return (
    <div>

      {/* Inject CSS for pulsing animation */}
      <style>{`
        @keyframes pulseError {
          0%   { box-shadow: 0 0 0 0   rgba(255,77,79,0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(255,77,79,0); }
          100% { box-shadow: 0 0 0 0   rgba(255,77,79,0); }
        }
        .op-card-error { animation: pulseError 1.8s infinite; }
        .op-machine-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }
        .op-machine-card { transition: transform 0.18s ease, box-shadow 0.18s ease; }
      `}</style>

      {/* ── Operating Mode Control ── */}


      {/* ── Page Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              <AppstoreOutlined style={{ marginRight: 10, color: '#1677ff' }} />
              Giám sát {zone}
            </Title>
            <Text type="secondary">Danh sách thiết bị — cập nhật theo thời gian thực</Text>
          </div>

          {/* Summary Pills */}
          <Space wrap size={8}>
            <Tag color="success" style={{ borderRadius: 20, padding: '4px 14px', fontSize: 13 }}>
              <ThunderboltOutlined /> Đang chạy: <strong>{counts.running}</strong>
            </Tag>
            <Tag style={{ borderRadius: 20, padding: '4px 14px', fontSize: 13, background: '#fafafa', borderColor: '#d9d9d9' }}>
              <PauseCircleOutlined /> Chờ: <strong>{counts.idle}</strong>
            </Tag>
                <div style={{ marginBottom: 5 }}>
        <OperatingModeToggle />
                </div>
            {counts.error > 0 && (
              <Tag color="error" style={{ borderRadius: 20, padding: '4px 14px', fontSize: 13 }}>
                <WarningOutlined /> Lỗi: <strong>{counts.error}</strong>
              </Tag>
            )}
            {counts.maintenance > 0 && (
              <Tag color="warning" style={{ borderRadius: 20, padding: '4px 14px', fontSize: 13 }}>
                <ToolOutlined /> Bảo trì: <strong>{counts.maintenance}</strong>
              </Tag>
            )}
          </Space>
        </div>
      </div>

      {/* ── Machine Grid ── */}
      <Row gutter={[20, 20]}>
        {zoneMachines.map(machine => {
          const cfg = statusCfg[machine.status];
          const isRunning = machine.status === 'Running';
          const isIdle = machine.status === 'Idle';
          const isError = machine.status === 'Error';

          return (
            <Col key={machine.id} xs={24} sm={12} xl={8} xxl={6}>
              <div
                className={`op-machine-card${isError ? ' op-card-error' : ''}`}
                style={{
                  borderRadius: 16,
                  border: `2px solid ${cfg.border}`,
                  background: cfg.bg,
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
                onClick={() => router.push(`/operator/machine/${machine.id}`)}
              >
                {/* ── Card Header ── */}
                <div
                  style={{
                    padding: '14px 18px',
                    borderBottom: `1px solid ${cfg.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: cfg.headerBg,
                  }}
                >
                  <div>
                    <Text strong style={{ fontSize: 17, color: '#141414', letterSpacing: 0.5 }}>
                      {machine.id}
                    </Text>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 1 }}>{machine.name}</div>
                  </div>
                  <Space>
                    {isError && !machine.errorAcked && (
                      <Badge status="error" />
                    )}
                    <Tag
                      color={cfg.tagColor}
                      style={{ borderRadius: 20, border: 'none', fontSize: 12, padding: '3px 10px', margin: 0 }}
                      icon={
                        isRunning ? <ThunderboltOutlined /> :
                        isIdle    ? <PauseCircleOutlined /> :
                        isError   ? <WarningOutlined />     : <ToolOutlined />
                      }
                    >
                      {cfg.text}
                    </Tag>
                  </Space>
                </div>

                {/* ── Card Body ── */}
                <div style={{ padding: '18px 18px 14px' }}>

                  {/* ERROR state */}
                  {isError && (
                    <div
                      style={{
                        background: 'rgba(255,77,79,0.08)',
                        border: '1px dashed #ffccc7',
                        borderRadius: 10,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ color: '#ff4d4f', fontWeight: 700, fontSize: 14, marginBottom: 5 }}>
                        ⚠️ {machine.errorCode}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                        {machine.errorMsg}
                      </Text>
                    </div>
                  )}

                  {/* MAINTENANCE state */}
                  {machine.status === 'Maintenance' && (
                    <div style={{ textAlign: 'center', padding: '22px 0' }}>
                      <ToolOutlined style={{ fontSize: 40, color: '#faad14', display: 'block', marginBottom: 10 }} />
                      <Text type="secondary">Đang bảo trì định kỳ</Text>
                    </div>
                  )}

                  {/* RUNNING / IDLE: Sensor display */}
                  {(isRunning || isIdle) && (
                    <>
                      {/* Large sensor numbers */}
                      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                        <div
                          style={{
                            flex: 1,
                            background: 'rgba(255,122,0,0.09)',
                            borderRadius: 12,
                            padding: '12px 0',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>🌡️ Nhiệt độ</div>
                          <div style={{ fontSize: 40, fontWeight: 900, color: '#ff7a00', lineHeight: 1 }}>
                            {machine.temp !== undefined ? machine.temp : '--'}
                          </div>
                          <div style={{ fontSize: 13, color: '#ff7a00', fontWeight: 600, marginTop: 2 }}>°C</div>
                        </div>
                        <div
                          style={{
                            flex: 1,
                            background: 'rgba(22,119,255,0.09)',
                            borderRadius: 12,
                            padding: '12px 0',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 3 }}>💧 Độ ẩm</div>
                          <div style={{ fontSize: 40, fontWeight: 900, color: '#1677ff', lineHeight: 1 }}>
                            {machine.humidity !== undefined ? machine.humidity : '--'}
                          </div>
                          <div style={{ fontSize: 13, color: '#1677ff', fontWeight: 600, marginTop: 2 }}>%</div>
                        </div>
                      </div>

                      {/* Running: recipe + progress */}
                      {isRunning && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                            <BookOutlined style={{ color: '#1677ff', fontSize: 12 }} />
                            <Text style={{ fontSize: 12, color: '#1677ff' }}>{machine.recipe}</Text>
                            <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
                              <ClockCircleOutlined /> {machine.startTime}
                            </Text>
                          </div>
                          <Progress
                            percent={Math.round(machine.progress || 0)}
                            size="small"
                            strokeColor={{ '0%': '#1677ff', '100%': '#52c41a' }}
                          />
                        </>
                      )}

                      {/* Idle: hint */}
                      {isIdle && (
                        <div style={{ textAlign: 'center', paddingTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>Sẵn sàng nhận lệnh</Text>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Card Footer ── */}
                <div
                  style={{
                    padding: '10px 18px',
                    borderTop: `1px solid ${cfg.border}`,
                    background: 'rgba(255,255,255,0.55)',
                  }}
                >
                  {isError ? (
                    <Button
                      danger
                      block
                      icon={<WarningOutlined />}
                      style={{ borderRadius: 10, fontWeight: 600 }}
                      onClick={e => {
                        e.stopPropagation();
                        router.push(`/operator/machine/${machine.id}`);
                      }}
                    >
                      Xử lý sự cố →
                    </Button>
                  ) : isIdle ? (
                    <Tooltip title="Chọn công thức và khởi động ngay">
                      <Button
                        type="primary"
                        block
                        icon={<PlayCircleOutlined />}
                        style={{ borderRadius: 10, background: '#52c41a', borderColor: '#52c41a', fontWeight: 600 }}
                        onClick={e => {
                          e.stopPropagation();
                          setQuickStartMachine(machine);
                          setSelectedRecipe(null);
                        }}
                      >
                        Khởi động nhanh
                      </Button>
                    </Tooltip>
                  ) : isRunning ? (
                    <Button
                      block
                      icon={<RightOutlined />}
                      style={{ borderRadius: 10, color: '#1677ff', borderColor: '#91caff', background: '#e6f4ff' }}
                    >
                      Chi tiết & Điều khiển
                    </Button>
                  ) : (
                    <Button block disabled style={{ borderRadius: 10 }}>
                      Đang bảo trì
                    </Button>
                  )}
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* ── Quick Start Modal ── */}
      <Modal
        title={
          <Space>
            <PlayCircleOutlined style={{ color: '#52c41a' }} />
            <span>Khởi động nhanh — {quickStartMachine?.name}</span>
          </Space>
        }
        open={!!quickStartMachine}
        onOk={handleQuickStart}
        onCancel={() => { setQuickStartMachine(null); setSelectedRecipe(null); }}
        okText={<><PlayCircleOutlined /> Khởi động</>}
        cancelText="Hủy"
        okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a', borderRadius: 7 } }}
        cancelButtonProps={{ style: { borderRadius: 7 } }}
        width={500}
        styles={{ body: { maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 } }}
      >
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 14 }}>
            Chọn công thức sấy để áp dụng cho{' '}
            <Text strong>{quickStartMachine?.name}</Text>:
          </Text>

          <Radio.Group
            style={{ width: '100%' }}
            value={selectedRecipe?.id}
            onChange={e => setSelectedRecipe(recipes.find(r => r.id === e.target.value) || null)}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {recipes.map(recipe => (
                <Radio
                  key={recipe.id}
                  value={recipe.id}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: selectedRecipe?.id === recipe.id ? '2px solid #52c41a' : '1px solid #f0f0f0',
                    borderRadius: 10,
                    background: selectedRecipe?.id === recipe.id ? '#f6ffed' : '#fafafa',
                    margin: 0,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                      <Text strong>{recipe.name}</Text>
                      <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>🌡️ {recipe.temp}°C</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>💧 {recipe.humidity}%</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>🍎 {recipe.fruit}</Text>
                      </div>
                    </div>
                    <Tag style={{ borderRadius: 12 }}>{recipe.duration}h</Tag>
                  </div>
                </Radio>
              ))}
            </Space>
          </Radio.Group>

          {selectedRecipe && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#f6ffed', borderRadius: 10, border: '1px solid #b7eb8f' }}>
              <Text style={{ color: '#52c41a', fontSize: 13 }}>
                ✓ Sẵn sàng khởi động với <strong>{selectedRecipe.name}</strong> — Thời gian dự kiến: {selectedRecipe.duration}h
              </Text>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
