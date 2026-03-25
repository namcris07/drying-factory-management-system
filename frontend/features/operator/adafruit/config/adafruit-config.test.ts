import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

type ConfigModule = typeof import('@/features/operator/adafruit/config/adafruit-config');

const ENV_KEYS = [
  'NEXT_PUBLIC_USE_SHARED_FEEDS',
  'NEXT_PUBLIC_FEED_TEMPERATURE',
  'NEXT_PUBLIC_FEED_HUMIDITY',
  'NEXT_PUBLIC_FEED_LIGHT',
  'NEXT_PUBLIC_FEED_FAN',
  'NEXT_PUBLIC_FEED_FAN_LEVEL',
  'NEXT_PUBLIC_FEED_RELAY',
  'NEXT_PUBLIC_FEED_LCD',
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};

for (const key of ENV_KEYS) {
  ORIGINAL_ENV[key] = process.env[key];
}

async function loadConfigModule(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}): Promise<ConfigModule> {
  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }

  vi.resetModules();
  return import('@/features/operator/adafruit/config/adafruit-config');
}

describe('adafruitConfig', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const original = ORIGINAL_ENV[key];
      if (original === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    vi.resetModules();
  });

  it('normal: uses shared feed defaults when NEXT_PUBLIC_USE_SHARED_FEEDS is not false', async () => {
    const { getMachineFeeds } = await loadConfigModule();
    const feeds = getMachineFeeds('M-A1');

    expect(feeds).toEqual({
      temperature: 'BBC_TEMP',
      humidity: 'Humidity',
      light: 'Lux',
      fan: 'fan_state',
      fanLevel: 'fan_level',
      relay: 'BBC_LED',
      lcd: 'lcd_text',
    });
  });

  it('edge: shared mode honors feed overrides and ignores machine id format', async () => {
    const { getMachineFeeds } = await loadConfigModule({
      NEXT_PUBLIC_FEED_TEMPERATURE: 'TEMP_OVERRIDE',
      NEXT_PUBLIC_FEED_HUMIDITY: 'HUM_OVERRIDE',
      NEXT_PUBLIC_FEED_LIGHT: 'LIGHT_OVERRIDE',
      NEXT_PUBLIC_FEED_FAN: 'FAN_OVERRIDE',
      NEXT_PUBLIC_FEED_FAN_LEVEL: 'FAN_LEVEL_OVERRIDE',
      NEXT_PUBLIC_FEED_RELAY: 'RELAY_OVERRIDE',
      NEXT_PUBLIC_FEED_LCD: 'LCD_OVERRIDE',
    });
    const feeds = getMachineFeeds(' MAY-KY-TU-DAC-BIET/#01 ');

    expect(feeds).toEqual({
      temperature: 'TEMP_OVERRIDE',
      humidity: 'HUM_OVERRIDE',
      light: 'LIGHT_OVERRIDE',
      fan: 'FAN_OVERRIDE',
      fanLevel: 'FAN_LEVEL_OVERRIDE',
      relay: 'RELAY_OVERRIDE',
      lcd: 'LCD_OVERRIDE',
    });
  });

  it('normal: builds machine-specific feed keys when NEXT_PUBLIC_USE_SHARED_FEEDS=false', async () => {
    const { getMachineFeeds } = await loadConfigModule({
      NEXT_PUBLIC_USE_SHARED_FEEDS: 'false',
    });
    const feeds = getMachineFeeds('M-A1');

    expect(feeds).toEqual({
      temperature: 'drytech.m-a1-temperature',
      humidity: 'drytech.m-a1-humidity',
      light: 'drytech.m-a1-light',
      fan: 'drytech.m-a1-fan',
      fanLevel: 'drytech.m-a1-fan-level',
      relay: 'drytech.m-a1-relay',
      lcd: 'drytech.m-a1-lcd',
    });
  });

  it('edge: machine-specific mode lowercases the entire machine id', async () => {
    const { getMachineFeeds } = await loadConfigModule({
      NEXT_PUBLIC_USE_SHARED_FEEDS: 'false',
    });
    const feeds = getMachineFeeds('M-A_9X');

    expect(feeds.temperature).toBe('drytech.m-a_9x-temperature');
    expect(feeds.fanLevel).toBe('drytech.m-a_9x-fan-level');
  });

  it('error: throws when machineId is invalid in machine-specific mode', async () => {
    const { getMachineFeeds } = await loadConfigModule({
      NEXT_PUBLIC_USE_SHARED_FEEDS: 'false',
    });

    expect(() => getMachineFeeds(undefined as unknown as string)).toThrow(TypeError);
  });

  it('keeps warning thresholds stable', async () => {
    const { AIO_THRESHOLDS } = await loadConfigModule();

    expect(AIO_THRESHOLDS).toEqual({
      tempMax: 90,
      tempWarn: 82,
      humMin: 8,
      humMax: 85,
      lightDoor: 700,
    });
  });
});
