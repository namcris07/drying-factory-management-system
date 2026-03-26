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

// true: tat ca may dung chung 1 bo feed (phu hop demo nhanh voi 1 bo sensor/relay)
// false: dung feed theo tung machine ID (drytech.m-a1-...)
const USE_SHARED_FEEDS = process.env.NEXT_PUBLIC_USE_SHARED_FEEDS !== 'false';

const SHARED_FEEDS: DeviceFeeds = {
  // Co the override qua .env.local neu can
  temperature: process.env.NEXT_PUBLIC_FEED_TEMPERATURE || 'BBC_TEMP',
  humidity: process.env.NEXT_PUBLIC_FEED_HUMIDITY || 'Humidity',
  light: process.env.NEXT_PUBLIC_FEED_LIGHT || 'Lux',
  fanLevel: process.env.NEXT_PUBLIC_FEED_FAN_LEVEL || 'fan_level',
  led:
    process.env.NEXT_PUBLIC_FEED_LED ||
    process.env.NEXT_PUBLIC_FEED_RELAY ||
    'BBC_LED',
  lcd: process.env.NEXT_PUBLIC_FEED_LCD || 'lcd_text',
};

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

/**
 * Sinh feed key tự động từ Machine ID.
 * Ví dụ M-A1 → drytech.m-a1-temperature, drytech.m-a1-fan, ...
 */
export function getMachineFeeds(machineId: string): DeviceFeeds {
  if (USE_SHARED_FEEDS) {
    return SHARED_FEEDS;
  }

  const id = machineId.toLowerCase();
  return {
    temperature: `drytech.${id}-temperature`,
    humidity:    `drytech.${id}-humidity`,
    light:       `drytech.${id}-light`,
    fanLevel:    `drytech.${id}-fan-level`,
    led:         `drytech.${id}-led`,
    lcd:         `drytech.${id}-lcd`,
  };
}

/** Ngưỡng cảnh báo — đồng bộ với SystemThresholds */
export const AIO_THRESHOLDS = {
  tempMax:    90,   // °C — đỏ
  tempWarn:   82,   // °C — vàng
  humMin:     8,    // % — quá khô
  humMax:     85,   // % — quá ẩm
  lightDoor:  90,  // lux — cửa có thể mở
};
