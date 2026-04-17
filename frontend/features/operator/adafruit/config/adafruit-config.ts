/**
 * config/adafruitConfig.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cấu hình kết nối Adafruit IO — NGUỒN SỰ THẬT duy nhất.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const AIO_CONFIG = {
  username:          process.env.NEXT_PUBLIC_AIO_USERNAME || 'YOUR_AIO_USERNAME',
  apiKey:            process.env.NEXT_PUBLIC_AIO_KEY || 'YOUR_AIO_KEY',
  baseUrl:           'https://io.adafruit.com/api/v2',
  pollingIntervalMs: 15000,                  // Poll mỗi 5 giây
  maxRatePerMinute:  30,                    // Free plan: 30 req/phút
};

export const MODE_FEED_KEY =
  process.env.NEXT_PUBLIC_FEED_MODE || 'mode_state';

/**
 * Feed Keys cho từng máy sấy
 * INPUT  (đọc từ cảm biến) : temperature, humidity, light
 * OUTPUT (ghi lệnh ra)     : fanLevel, led, lcd
 */
export interface DeviceFeeds {
  temperature: string; // DHT20 — °C
  humidity:    string; // DHT20 — %
  light:       string; // Cảm biến ánh sáng — lux
  fanLevel:    string; // Level quạt: 0..100
  led:         string; // LED giả lập: "1" bật / "0" tắt
  lcd:         string; // LCD: ghi chuỗi text
}

type ResolveMachineFeedsInput = {
  machineId: string;
  sensorFeeds?: string[];
  allowGeneratedFallback?: boolean;
};

const FEED_SUFFIX = {
  temperature: 'temperature',
  humidity: 'humidity',
  light: 'light',
  fanLevel: 'fan-level',
  led: 'led',
  lcd: 'lcd',
} as const;

function normalizeMachineId(machineId: string): string {
  const normalized = machineId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    throw new TypeError('machineId is required');
  }

  return normalized;
}

/**
 * Sinh feed key tự động từ Machine ID.
 * Ví dụ M-A1 → drytech.m-a1-temperature, drytech.m-a1-fan, ...
 */
export function getMachineFeeds(machineId: string): DeviceFeeds {
  const id = normalizeMachineId(machineId);
  return {
    temperature: `drytech.${id}-${FEED_SUFFIX.temperature}`,
    humidity: `drytech.${id}-${FEED_SUFFIX.humidity}`,
    light: `drytech.${id}-${FEED_SUFFIX.light}`,
    fanLevel: `drytech.${id}-${FEED_SUFFIX.fanLevel}`,
    led: `drytech.${id}-${FEED_SUFFIX.led}`,
    lcd: `drytech.${id}-${FEED_SUFFIX.lcd}`,
  };
}

function normalizeFeed(feed: string): string {
  return feed.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickFeedByTokens(
  feeds: string[],
  tokens: string[],
): string | null {
  for (const feed of feeds) {
    const normalized = normalizeFeed(feed);
    if (tokens.some((token) => normalized.includes(token))) {
      return feed;
    }
  }
  return null;
}

function uniqueFeeds(feeds: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(feeds.map((feed) => String(feed ?? '').trim()).filter(Boolean)),
  );
}

function extractFeedKey(raw: string): string {
  const input = String(raw ?? '').trim();
  if (!input) return '';

  const lower = input.toLowerCase();
  const marker = '/feeds/';
  const markerIndex = lower.indexOf(marker);

  const key = markerIndex >= 0 ? input.slice(markerIndex + marker.length) : input;
  return key.split('/')[0]?.trim() ?? '';
}

function canonicalizeFeedKey(feed: string, machineId: string): string {
  const key = extractFeedKey(feed);
  if (!key) return '';

  const normalizedMachineId = normalizeMachineId(machineId);
  const lower = key.toLowerCase();
  if (lower.startsWith('drytech.')) return lower;

  if (lower.startsWith(`${normalizedMachineId}-`)) {
    return `drytech.${lower}`;
  }

  return lower;
}

/**
 * Ưu tiên feed đã cấu hình trong DB để tránh publish nhầm feed tự sinh.
 * Chỉ fallback sang feed generate theo machineId khi được cho phép rõ ràng.
 */
export function resolveConfiguredMachineFeeds(
  input: ResolveMachineFeedsInput,
): DeviceFeeds | null {
  const configuredFeeds = uniqueFeeds(input.sensorFeeds ?? []).map((feed) =>
    canonicalizeFeedKey(feed, input.machineId),
  );

  const mapped: DeviceFeeds = {
    temperature:
      pickFeedByTokens(configuredFeeds, ['temperature', 'temp']) ||
      '',
    humidity:
      pickFeedByTokens(configuredFeeds, ['humidity', 'humid']) ||
      '',
    light:
      pickFeedByTokens(configuredFeeds, ['light', 'lux', 'ldr']) ||
      '',
    fanLevel:
      pickFeedByTokens(configuredFeeds, ['fanlevel', 'fan']) ||
      '',
    led:
      pickFeedByTokens(configuredFeeds, ['led']) ||
      '',
    lcd:
      pickFeedByTokens(configuredFeeds, ['lcd']) ||
      '',
  };

  const hasAnyMappedFeed = Object.values(mapped).some(Boolean);
  if (hasAnyMappedFeed) {
    return mapped;
  }

  if (input.allowGeneratedFallback) {
    return getMachineFeeds(input.machineId);
  }

  return null;
}

/** Ngưỡng cảnh báo — đồng bộ với SystemThresholds */
export const AIO_THRESHOLDS = {
  tempMax:    90,   // °C — đỏ
  tempWarn:   82,   // °C — vàng
  humMin:     8,    // % — quá khô
  humMax:     85,   // % — quá ẩm
  lightDoor:  90,  // lux — cửa có thể mở
};
