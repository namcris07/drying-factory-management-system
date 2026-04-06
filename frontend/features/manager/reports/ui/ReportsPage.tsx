"use client";

/**
 * app/(manager)/reports/page.tsx
 * Xuất Báo cáo
 */
import { useEffect, useMemo, useState } from 'react';
import { Typography, Card, Row, Col, Button, Space, DatePicker, Select, Divider, App, Spin, Table, Tag, Pagination } from 'antd';
import { FileTextOutlined, DownloadOutlined, FilePdfOutlined, FileExcelOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { analyticsApi, ApiAnalyticsSummary, ApiAnalyticsTrend, ApiAnalyticsHourly } from '@/shared/lib/api';
import { exportRowsToCsv, exportSheetsToExcel } from '@/shared/lib/export';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type ZoneFilter = 'all' | 'zoneA';
type TrendPeriod = 'day' | 'week' | 'month' | 'year';

type ReportRow = {
  key: string;
  date: string;
  total: number;
  success: number;
  fail: number;
  successRate: number;
  status: 'success' | 'fail';
};

const reportTypes = [
  { icon: <FilePdfOutlined style={{ fontSize: 32, color: '#1677ff' }} />, title: 'Xuất CSV', desc: 'Tải chi tiết mẻ theo ngày dưới dạng CSV', format: 'CSV' },
  { icon: <FileExcelOutlined style={{ fontSize: 32, color: '#52c41a' }} />, title: 'Xuất Excel', desc: 'Workbook nhiều sheet: Summary, Trend, Hourly Avg', format: 'Excel' },
];

export default function ReportsPage() {
  const { message } = App.useApp();
  const [zone, setZone] = useState<ZoneFilter>('all');
  const [period, setPeriod] = useState<TrendPeriod>('day');
  const [detailFilter, setDetailFilter] = useState<'all' | 'success' | 'fail'>('all');
  const [reportPagination, setReportPagination] = useState({ current: 1, pageSize: 10 });
    const currentPage = reportPagination.current;
    const currentPageSize = reportPagination.pageSize;

  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(89, 'day').startOf('day'),
    dayjs().endOf('day'),
  ]);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<ApiAnalyticsSummary | null>(null);
  const [trend, setTrend] = useState<ApiAnalyticsTrend | null>(null);
  const [hourly, setHourly] = useState<ApiAnalyticsHourly | null>(null);

  const query = useMemo(() => {
    const [from, to] = range;
    return {
      from: from.startOf('day').toISOString(),
      to: to.endOf('day').toISOString(),
      zoneId: zone === 'zoneA' ? 1 : undefined,
    };
  }, [range, zone]);

  useEffect(() => {
    setReportPagination((prev) => ({ ...prev, current: 1 }));
  }, [range, zone, detailFilter, period]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [s, t, h] = await Promise.all([
          analyticsApi.getSummary(query),
          analyticsApi.getTrend({
            ...query,
            period,
            status: detailFilter,
            page: currentPage,
            pageSize: currentPageSize,
          }),
          analyticsApi.getHourlyAvg({ ...query, metric: 'temperature' }),
        ]);

        if (!mounted) return;
        setSummary(s);
        setTrend(t);
        setHourly(h);
      } catch {
        if (!mounted) return;
        message.error('Không thể tải báo cáo từ dữ liệu thực tế.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [query, message, period, detailFilter, currentPage, currentPageSize]);

  const reportRows: ReportRow[] = (trend?.points ?? []).map((p) => ({
    key: p.date,
    date: period === 'day' ? dayjs(p.date).format('DD/MM') : p.date,
    total: p.total,
    success: p.success,
    fail: p.fail,
    successRate: p.successRate,
    status: p.fail > 0 ? 'fail' : 'success',
  }));

  const hourlyRows = (hourly?.points ?? []).map((p) => ({
    key: p.hour,
    hour: p.hour,
    avg: p.avg,
    samples: p.samples,
  }));

  const exportCsv = () => {
    exportRowsToCsv(
      `reports-${dayjs(range[0]).format('YYYYMMDD')}-${dayjs(range[1]).format('YYYYMMDD')}.csv`,
      reportRows.map((row) => ({
        Ngay: row.date,
        'Tong me': row.total,
        Success: row.success,
        Fail: row.fail,
        'Ty le Success (%)': row.successRate.toFixed(2),
        TrangThai: row.status === 'fail' ? 'Co fail' : 'On dinh',
      })),
    );
    message.success('Đã tải CSV báo cáo.');
  };

  const exportExcel = () => {
    exportSheetsToExcel(
      `reports-${dayjs(range[0]).format('YYYYMMDD')}-${dayjs(range[1]).format('YYYYMMDD')}.xlsx`,
      [
        {
          name: 'Summary',
          rows: [
            {
              'Tong me': summary?.batches.total ?? 0,
              Success: summary?.batches.success ?? 0,
              Fail: summary?.batches.fail ?? 0,
              Running: summary?.batches.running ?? 0,
              'Ty le Success (%)': summary?.batches.successRate ?? 0,
              'Ty le Fail (%)': summary?.batches.failRate ?? 0,
            },
          ],
        },
        {
          name: 'Daily Trend',
          rows: reportRows.map((row) => ({
            Ngay: row.date,
            'Tong me': row.total,
            Success: row.success,
            Fail: row.fail,
            'Ty le Success (%)': row.successRate.toFixed(2),
            TrangThai: row.status === 'fail' ? 'Co fail' : 'On dinh',
          })),
        },
        {
          name: 'Hourly Avg',
          rows: hourlyRows.map((row) => ({
            Gio: row.hour,
            'Nhiệt độ TB': row.avg,
            Mẫu: row.samples,
          })),
        },
      ],
    );
    message.success('Đã tải Excel báo cáo.');
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 10, color: '#1677ff' }} />
          Xuất Báo cáo
        </Title>
        <Text type="secondary">Tạo và tải xuống các báo cáo sản xuất định kỳ</Text>
      </div>

      {/* Filters */}
      <Card style={{ borderRadius: 12, marginBottom: 24 }}>
        <Space wrap>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Khoảng thời gian</Text>
            <RangePicker
              value={range}
              onChange={(next) => {
                if (!next || !next[0] || !next[1]) return;
                setRange([next[0], next[1]]);
              }}
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Khu vực</Text>
            <Select value={zone} onChange={(v) => setZone(v)} style={{ width: 160 }}>
              <Select.Option value="all">Tất cả khu vực</Select.Option>
              <Select.Option value="zoneA">Zone A</Select.Option>
            </Select>
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Chi tiết</Text>
            <Select value={detailFilter} onChange={(v) => setDetailFilter(v)} style={{ width: 180 }}>
              <Select.Option value="all">Tất cả trạng thái</Select.Option>
              <Select.Option value="success">Chỉ success</Select.Option>
              <Select.Option value="fail">Chỉ fail</Select.Option>
            </Select>
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Nhóm dữ liệu</Text>
            <Select value={period} onChange={(v) => setPeriod(v)} style={{ width: 160 }}>
              <Select.Option value="day">Theo ngày</Select.Option>
              <Select.Option value="week">Theo tuần</Select.Option>
              <Select.Option value="month">Theo tháng</Select.Option>
              <Select.Option value="year">Theo năm</Select.Option>
            </Select>
          </div>
        </Space>
      </Card>

      <Divider orientation="left">Chọn loại báo cáo</Divider>

      {/* Report Types */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {reportTypes.map((report, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card
              hoverable
              style={{ borderRadius: 12, textAlign: 'center', height: '100%' }}
            >
              <div style={{ marginBottom: 16 }}>{report.icon}</div>
              <Title level={5} style={{ margin: '0 0 8px' }}>{report.title}</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{report.desc}</Text>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                style={{ borderRadius: 7 }}
                onClick={report.format === 'CSV' ? exportCsv : exportExcel}
              >
                Tải {report.format}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={8}>
              <Card>
                <Text type="secondary">Tổng mẻ trong kỳ</Text>
                <Title level={3} style={{ margin: '8px 0 0' }}>{summary?.batches.total ?? 0}</Title>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Text type="secondary">Success</Text>
                <Title level={3} style={{ margin: '8px 0 0', color: '#52c41a' }}>{summary?.batches.success ?? 0}</Title>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Text type="secondary">Fail</Text>
                <Title level={3} style={{ margin: '8px 0 0', color: '#ff4d4f' }}>{summary?.batches.fail ?? 0}</Title>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24}>
              <Card title="Nhiệt độ trung bình theo giờ (log thật)">
                <Table
                  size="small"
                  dataSource={hourlyRows}
                  pagination={{ pageSize: 8 }}
                  columns={[
                    { title: 'Giờ', dataIndex: 'hour', key: 'hour' },
                    { title: 'Nhiệt độ TB (°C)', dataIndex: 'avg', key: 'avg' },
                    { title: 'Số mẫu', dataIndex: 'samples', key: 'samples' },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          <Card title="Chi tiết theo ngày">
            <Table
              dataSource={reportRows}
              pagination={false}
              columns={[
                { title: period === 'day' ? 'Ngày' : period === 'week' ? 'Tuần' : period === 'month' ? 'Tháng' : 'Năm', dataIndex: 'date', key: 'date' },
                { title: 'Tổng mẻ', dataIndex: 'total', key: 'total' },
                {
                  title: 'Success',
                  dataIndex: 'success',
                  key: 'success',
                  render: (v: number) => <Tag color="success">{v}</Tag>,
                },
                {
                  title: 'Fail',
                  dataIndex: 'fail',
                  key: 'fail',
                  render: (v: number) => <Tag color="error">{v}</Tag>,
                },
                {
                  title: 'Tỉ lệ Success',
                  dataIndex: 'successRate',
                  key: 'successRate',
                  render: (v: number) => `${v.toFixed(2)}%`,
                },
                {
                  title: 'Trạng thái',
                  key: 'status',
                  render: (_: unknown, row: { status: 'success' | 'fail' }) => (
                    <Tag color={row.status === 'fail' ? 'warning' : 'success'}>
                      {row.status === 'fail' ? 'Có fail' : 'Ổn định'}
                    </Tag>
                  ),
                },
              ]}
            />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Text type="secondary">Hiển thị</Text>
                <Select
                  value={reportPagination.pageSize}
                  style={{ width: 96 }}
                  onChange={(nextPageSize: number) => {
                    setReportPagination({ current: 1, pageSize: nextPageSize });
                  }}
                  options={[
                    { value: 10, label: '10 / trang' },
                    { value: 20, label: '20 / trang' },
                    { value: 30, label: '30 / trang' },
                  ]}
                />
              </Space>
              <Pagination
                current={reportPagination.current}
                pageSize={reportPagination.pageSize}
                total={trend?.pagination?.total ?? 0}
                showSizeChanger={false}
                showQuickJumper={false}
                onChange={(current, pageSize) => {
                  setReportPagination({ current, pageSize });
                }}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
