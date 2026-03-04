/**
 * services/adafruitAPI.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lớp duy nhất giao tiếp với Adafruit IO REST API.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AIO_CONFIG } from '@/config/adafruitConfig';

// ── Types (khớp Adafruit IO REST API) ────────────────────────────────────────

export interface AIOFeedValue {
  id:         string;
  value:      string;   // Adafruit IO luôn trả string
  feed_id:    number;
  feed_key:   string;
  created_at: string;   // ISO 8601
  lat:        number | null;
  lon:        number | null;
  ele:        number | null;
}

/** Dữ liệu cảm biến đã parse */
export interface SensorData {
  temperature: number; // °C
  humidity:    number; // %
  light:       number; // lux
  timestamp:   string; // ISO 8601
}

/** Trạng thái thiết bị đầu ra */
export interface DeviceOutput {
  fanOn:      boolean;
  relayOn:    boolean;
  lcdMessage: string;
}

/** Điểm lịch sử cho biểu đồ */
export interface HistoryPoint {
  time:        string;
  temperature: number;
  humidity:    number;
  light:       number;
}

// ── REAL API FUNCTIONS (dùng khi có credentials) ──────────────────────────

function aioHeaders(): HeadersInit {
  return {
    'X-AIO-Key':    AIO_CONFIG.apiKey,
    'Content-Type': 'application/json',
  };
}

/**
 * [REAL] Lấy giá trị mới nhất của một feed
 */
export async function fetchFeedLastValue(feedKey: string): Promise<AIOFeedValue> {
  const url = `${AIO_CONFIG.baseUrl}/${AIO_CONFIG.username}/feeds/${feedKey}/data/last`;
  const res  = await fetch(url, { headers: aioHeaders() });
  if (!res.ok) throw new Error(`[AIO] GET last failed — ${res.status} — feed: ${feedKey}`);
  return res.json() as Promise<AIOFeedValue>;
}

/**
 * [REAL] Lấy N điểm gần nhất (cho biểu đồ lịch sử)
 */
export async function fetchFeedHistory(feedKey: string, limit = 20): Promise<AIOFeedValue[]> {
  const url = `${AIO_CONFIG.baseUrl}/${AIO_CONFIG.username}/feeds/${feedKey}/data?limit=${limit}`;
  const res  = await fetch(url, { headers: aioHeaders() });
  if (!res.ok) throw new Error(`[AIO] GET history failed — ${res.status} — feed: ${feedKey}`);
  return res.json() as Promise<AIOFeedValue[]>;
}

/**
 * [REAL] Publish một giá trị lên feed (điều khiển thiết bị)
 */
export async function publishFeedValue(feedKey: string, value: string | number): Promise<AIOFeedValue> {
  const url = `${AIO_CONFIG.baseUrl}/${AIO_CONFIG.username}/feeds/${feedKey}/data`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: aioHeaders(),
    body:    JSON.stringify({ value: String(value) }),
  });
  if (!res.ok) throw new Error(`[AIO] POST failed — ${res.status} — feed: ${feedKey}, value: ${value}`);
  return res.json() as Promise<AIOFeedValue>;
}

// ── MOCK ENGINE (cho development) ────────────────────────────────────

const _mockStore: Record<string, number | string> = {};

function _initMockValue(feedKey: string, targetTemp = 65, targetHum = 18): string {
  if (feedKey.includes('temperature')) return String((targetTemp - 3 + Math.random() * 6).toFixed(1));
  if (feedKey.includes('humidity'))    return String((targetHum  - 2 + Math.random() * 4).toFixed(1));
  if (feedKey.includes('light'))       return String(Math.floor(80 + Math.random() * 180));
  if (feedKey.includes('fan'))         return '0';
  if (feedKey.includes('relay'))       return '0';
  if (feedKey.includes('lcd'))         return 'Sẵn sàng';
  return '0';
}

/** [MOCK] Đọc feed */
export function mockFetchFeedLastValue(
  feedKey: string,
  opts?: { targetTemp?: number; targetHum?: number },
): AIOFeedValue {
  if (_mockStore[feedKey] === undefined) {
    _mockStore[feedKey] = _initMockValue(feedKey, opts?.targetTemp, opts?.targetHum);
  }
  if (feedKey.includes('temperature')) {
    const cur = parseFloat(String(_mockStore[feedKey]));
    _mockStore[feedKey] = String(Math.max(30, Math.min(95, cur + (Math.random() - 0.5) * 1.4)).toFixed(1));
  }
  if (feedKey.includes('humidity')) {
    const cur = parseFloat(String(_mockStore[feedKey]));
    _mockStore[feedKey] = String(Math.max(5, Math.min(80, cur + (Math.random() - 0.5) * 0.8)).toFixed(1));
  }
  if (feedKey.includes('light')) {
    const cur = parseInt(String(_mockStore[feedKey]));
    _mockStore[feedKey] = String(Math.max(10, Math.min(1000, cur + Math.floor((Math.random() - 0.5) * 30))));
  }
  return {
    id: `mock-${Math.random().toString(36).slice(2, 8)}`,
    value: String(_mockStore[feedKey]),
    feed_id: Math.floor(Math.random() * 9999),
    feed_key: feedKey,
    created_at: new Date().toISOString(),
    lat: null, lon: null, ele: null,
  };
}

/** [MOCK] Ghi feed */
export function mockPublishFeedValue(feedKey: string, value: string | number): AIOFeedValue {
  _mockStore[feedKey] = String(value);
  return {
    id: `mock-${Math.random().toString(36).slice(2, 8)}`,
    value: String(value),
    feed_id: Math.floor(Math.random() * 9999),
    feed_key: feedKey,
    created_at: new Date().toISOString(),
    lat: null, lon: null, ele: null,
  };
}

export function getMockStoreSnapshot(): Record<string, string | number> {
  return { ..._mockStore };
}
