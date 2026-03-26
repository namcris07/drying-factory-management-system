/**
 * services/adafruitAPI.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Lớp duy nhất giao tiếp với Adafruit IO REST API.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AIO_CONFIG } from '@/features/operator/adafruit/config/adafruit-config';

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
  fanLevel:   number;
  ledOn:      boolean;
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
