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
  pollingIntervalMs: 5000,                  // Poll mỗi 5 giây
  maxRatePerMinute:  30,                    // Free plan: 30 req/phút
};

/**
 * Feed Keys cho từng máy sấy
 * INPUT  (đọc từ cảm biến) : temperature, humidity, light
 * OUTPUT (ghi lệnh ra)     : fan, relay, lcd
 */
export interface DeviceFeeds {
  temperature: string; // DHT20 — °C
  humidity:    string; // DHT20 — %
  light:       string; // Cảm biến ánh sáng — lux
  fan:         string; // Quạt: "1" bật / "0" tắt
  relay:       string; // Relay: "1" đóng / "0" ngắt
  lcd:         string; // LCD: ghi chuỗi text
}

/**
 * Sinh feed key tự động từ Machine ID.
 * Ví dụ M-A1 → drytech.m-a1-temperature, drytech.m-a1-fan, ...
 */
export function getMachineFeeds(machineId: string): DeviceFeeds {
  const id = machineId.toLowerCase();
  return {
    temperature: `drytech.${id}-temperature`,
    humidity:    `drytech.${id}-humidity`,
    light:       `drytech.${id}-light`,
    fan:         `drytech.${id}-fan`,
    relay:       `drytech.${id}-relay`,
    lcd:         `drytech.${id}-lcd`,
  };
}

/** Ngưỡng cảnh báo — đồng bộ với SystemThresholds */
export const AIO_THRESHOLDS = {
  tempMax:    90,   // °C — đỏ
  tempWarn:   82,   // °C — vàng
  humMin:     8,    // % — quá khô
  humMax:     85,   // % — quá ẩm
  lightDoor:  700,  // lux — cửa có thể mở
};
