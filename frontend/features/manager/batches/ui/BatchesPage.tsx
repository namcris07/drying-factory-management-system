"use client";

/**
 * app/(manager)/batches/page.tsx
 * Lịch sử Mẻ sấy — kết nối backend thật
 */
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Typography, Card, Table, Tag, Space, Button, Select, Spin, App, Pagination } from 'antd';
import { HistoryOutlined, ExportOutlined } from '@ant-design/icons';
import { batchesApi, ApiBatch, ApiPagination } from '@/shared/lib/api';
import { exportRowsToCsv, exportSheetsToExcel } from '@/shared/lib/export';

const { Title, Text } = Typography;

type BatchStatusFilter = 'all' | 'running' | 'completed' | 'fail';

const LONG_RUNNING_THRESHOLD_HOURS = 8;

const normalizeStatus = (value: string | null | undefined): BatchStatusFilter => {
  const status = (value ?? '').toLowerCase();
  if (status === 'running' || status === 'completed' || status === 'fail') return status;
  return 'all';
};

const statusLabelMap: Record<BatchStatusFilter, string> = {
  all: 'Tất cả trạng thái',
  running: 'Đang chạy',
  completed: 'Hoàn thành',
  fail: 'Có lỗi',
};

const isRunningStatus = (status: string | null | undefined): boolean => {
  return (status ?? '').toLowerCase() === 'running';
};

const isCompletedStatus = (status: string | null | undefined): boolean => {
  return (status ?? '').toLowerCase() === 'completed';
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN');
};

const getBatchStartedAt = (batch: ApiBatch): string | null => {
  const opStarted = batch.batchOperations.find((op) => op.startedAt)?.startedAt;
  return opStarted ?? batch.startedAt;
};

const getBatchEndedAt = (batch: ApiBatch): string | null => {
  const endedValues = batch.batchOperations
    .map((op) => op.endedAt)
    .filter((endedAt): endedAt is string => Boolean(endedAt));

  if (endedValues.length === 0) return null;

  return endedValues.reduce((latest, current) => {
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  });
};

const getRecipeDurationMinutes = (batch: ApiBatch): number | null => {
  const recipe = batch.recipe;
  if (!recipe) return null;

  if (typeof recipe.timeDurationEst === 'number' && recipe.timeDurationEst > 0) {
    return recipe.timeDurationEst;
  }

  const stageDuration = (recipe.stages ?? []).reduce((sum, stage) => {
    const next = Number(stage.durationMinutes ?? 0);
    return sum + (Number.isFinite(next) ? next : 0);
  }, 0);

  return stageDuration > 0 ? stageDuration : null;
};

const getDisplayEndedAt = (batch: ApiBatch): { value: string | null; isEstimated: boolean } => {
  const endedAt = getBatchEndedAt(batch);
  if (endedAt) {
    return { value: endedAt, isEstimated: false };
  }

  if (!isCompletedStatus(batch.batchStatus)) {
    return { value: null, isEstimated: false };
  }

  const startedAt = getBatchStartedAt(batch);
  const durationMinutes = getRecipeDurationMinutes(batch);
  if (!startedAt || !durationMinutes) {
    return { value: null, isEstimated: false };
  }

  const estimated = new Date(new Date(startedAt).getTime() + durationMinutes * 60 * 1000).toISOString();
  return { value: estimated, isEstimated: true };
};

const formatDuration = (start: string | null, end: string | null, isRunning: boolean): string => {
  if (!start) return '—';
  if (!end && !isRunning) return '—';

  const startedAtMs = new Date(start).getTime();
  const endedAtMs = end ? new Date(end).getTime() : Date.now();
  const durationMs = endedAtMs - startedAtMs;

  if (!Number.isFinite(durationMs) || durationMs <= 0) return '—';

  const totalMinutes = Math.floor(durationMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

const isRunningLong = (batch: ApiBatch): boolean => {
  if (!isRunningStatus(batch.batchStatus)) return false;

  const startedAt = getBatchStartedAt(batch);
  if (!startedAt) return false;

  const elapsedHours = (Date.now() - new Date(startedAt).getTime()) / (1000 * 60 * 60);
  return Number.isFinite(elapsedHours) && elapsedHours > LONG_RUNNING_THRESHOLD_HOURS;
};

export default function BatchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [batches, setBatches] = useState<ApiBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginationMeta, setPaginationMeta] = useState<ApiPagination>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 10 });
  const [statusFilter, setStatusFilter] = useState<BatchStatusFilter>(
    normalizeStatus(searchParams.get('status')),
  );

  const currentPage = tablePagination.current;
  const currentPageSize = tablePagination.pageSize;

  useEffect(() => {
    setLoading(true);
    batchesApi
      .getAll({
        status: statusFilter,
        page: currentPage,
        pageSize: currentPageSize,
      })
      .then((res) => {
        setBatches(res.items);
        setPaginationMeta(res.pagination);
      })
      .catch(() => message.error('Không thể tải danh sách mẻ sấy.'))
      .finally(() => setLoading(false));
  }, [statusFilter, currentPage, currentPageSize, message]);

  useEffect(() => {
    setStatusFilter(normalizeStatus(searchParams.get('status')));
  }, [searchParams]);

  useEffect(() => {
    setTablePagination((prev) => ({ ...prev, current: 1 }));
  }, [statusFilter]);

  const exportRows = batches.map((batch) => {
    const startedAt = getBatchStartedAt(batch);
    const endedAtInfo = getDisplayEndedAt(batch);
    const endedAt = endedAtInfo.value;
    const isRunning = isRunningStatus(batch.batchStatus);

    return {
      'Thiết bị': batch.device?.deviceName ?? '—',
      'Công thức': batch.recipe?.recipeName ?? '—',
      'Trạng thái': batch.batchStatus ?? '—',
      'Kết quả': batch.batchResult ?? '—',
      'Bắt đầu': formatDateTime(startedAt),
      'Kết thúc': endedAt
        ? `${formatDateTime(endedAt)}${endedAtInfo.isEstimated ? ' (ước tính)' : ''}`
        : isRunning
          ? 'Đang chạy'
          : 'Chưa ghi nhận',
      'Thời lượng': formatDuration(startedAt, endedAt, isRunning),
      'Cảnh báo': isRunningLong(batch) ? `Chạy quá ${LONG_RUNNING_THRESHOLD_HOURS}h` : '—',
      'Chất lượng': batch.batchResult ?? '—',
    };
  });

  const handleExportCsv = () => {
    exportRowsToCsv(`batches-${statusFilter}.csv`, exportRows);
    message.success('Đã tải file CSV.');
  };

  const handleExportExcel = () => {
    exportSheetsToExcel(`batches-${statusFilter}.xlsx`, [
      { name: 'Batches', rows: exportRows },
    ]);
    message.success('Đã tải file Excel.');
  };

  const columns = [
    {
      title: 'Thiết bị',
      key: 'device',
      render: (_: unknown, r: ApiBatch) => r.device?.deviceName ?? '—',
    },
    {
      title: 'Công thức',
      key: 'recipe',
      render: (_: unknown, r: ApiBatch) => <Text strong>{r.recipe?.recipeName ?? '—'}</Text>,
    },
    {
      title: 'Trạng thái',
      key: 'batchStatus',
      render: (_: unknown, r: ApiBatch) => {
        const v = r.batchStatus ?? '—';
        return (
          <Space size={6}>
            <Tag color={v === 'Completed' ? 'success' : v === 'Running' ? 'processing' : v === 'Error' ? 'error' : 'default'}>
              {v === 'Completed' ? 'Hoàn thành' : v === 'Running' ? 'Đang chạy' : v === 'Error' ? 'Lỗi' : v}
            </Tag>
            {isRunningLong(r) && <Tag color="warning">Quá {LONG_RUNNING_THRESHOLD_HOURS}h</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Bắt đầu',
      key: 'startedAt',
      render: (_: unknown, r: ApiBatch) => formatDateTime(getBatchStartedAt(r)),
    },
    {
      title: 'Kết thúc',
      key: 'endedAt',
      render: (_: unknown, r: ApiBatch) => {
        const endedAtInfo = getDisplayEndedAt(r);
        const endedAt = endedAtInfo.value;
        const isRunning = isRunningStatus(r.batchStatus);
        if (endedAt) {
          const label = formatDateTime(endedAt);
          return endedAtInfo.isEstimated ? `${label}` : label;
        }
        return isRunning ? <Text type="secondary">Đang chạy</Text> : <Tag color="warning">Chưa ghi nhận</Tag>;
      },
    },
    {
      title: 'Thời lượng',
      key: 'duration',
      render: (_: unknown, r: ApiBatch) => {
        const startedAt = getBatchStartedAt(r);
        const endedAt = getDisplayEndedAt(r).value;
        const isRunning = isRunningStatus(r.batchStatus);
        return formatDuration(startedAt, endedAt, isRunning);
      },
    },
    {
      title: 'Chất lượng',
      dataIndex: 'batchResult',
      render: (v: string) => v ? <Tag color="green">{v}</Tag> : <Text type="secondary">—</Text>,
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <HistoryOutlined style={{ marginRight: 10, color: '#1677ff' }} />
            Lịch sử Mẻ sấy
          </Title>
          <Text type="secondary">Theo dõi và tra cứu lịch sử các mẻ sấy đã thực hiện</Text>
        </div>
        <Space>
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              const next = value === 'all' ? '/manager/batches' : `/manager/batches?status=${value}`;
              router.replace(next);
            }}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: statusLabelMap.all },
              { value: 'running', label: statusLabelMap.running },
              { value: 'completed', label: statusLabelMap.completed },
              { value: 'fail', label: statusLabelMap.fail },
            ]}
          />
          <Button onClick={handleExportCsv}>Xuất CSV</Button>
          <Button type="primary" icon={<ExportOutlined />} onClick={handleExportExcel}>Xuất Excel</Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12 }}>
        
        <Table
          dataSource={batches}
          columns={columns}
          rowKey="batchesID"
          pagination={false}
          
        />
        
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Text type="secondary">Hiển thị</Text>
            <Select
              value={tablePagination.pageSize}
              style={{ width: 96 }}
              onChange={(nextPageSize: number) => {
                setTablePagination({ current: 1, pageSize: nextPageSize });
              }}
              options={[
                { value: 10, label: '10 / trang' },
                { value: 20, label: '20 / trang' },
                { value: 30, label: '30 / trang' },
              ]}
            />
          </Space>
          <Pagination
            current={tablePagination.current}
            pageSize={tablePagination.pageSize}
            total={paginationMeta.total}
            showSizeChanger={false}
            showQuickJumper={false}
            onChange={(current, pageSize) => {
              setTablePagination({ current, pageSize });
            }}
          />
        </div>
      </Card>
    </div>
  );
}
