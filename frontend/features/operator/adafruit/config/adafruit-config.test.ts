import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

type ConfigModule = typeof import('@/features/operator/adafruit/config/adafruit-config');

const ENV_KEYS = [
  'NEXT_PUBLIC_FEED_TEMPERATURE',
  'NEXT_PUBLIC_FEED_HUMIDITY',
  'NEXT_PUBLIC_FEED_LIGHT',
  'NEXT_PUBLIC_FEED_FAN_LEVEL',
  'NEXT_PUBLIC_FEED_LED',
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

  it('normal: builds machine-specific feed keys from machine id', async () => {
    const { getMachineFeeds } = await loadConfigModule();
    const feeds = getMachineFeeds('M-A1');

    expect(feeds).toEqual({
      temperature: 'drytech.m-a1-temperature',
      humidity: 'drytech.m-a1-humidity',
      light: 'drytech.m-a1-light',
      fanLevel: 'drytech.m-a1-fan-level',
      led: 'drytech.m-a1-led',
      lcd: 'drytech.m-a1-lcd',
    });
  });

  it('edge: normalizes machine id and ignores old shared-feed override env vars', async () => {
    const { getMachineFeeds } = await loadConfigModule({
      NEXT_PUBLIC_FEED_TEMPERATURE: 'TEMP_OVERRIDE',
      NEXT_PUBLIC_FEED_HUMIDITY: 'HUM_OVERRIDE',
      NEXT_PUBLIC_FEED_LIGHT: 'LIGHT_OVERRIDE',
      NEXT_PUBLIC_FEED_FAN_LEVEL: 'FAN_LEVEL_OVERRIDE',
      NEXT_PUBLIC_FEED_LED: 'LED_OVERRIDE',
      NEXT_PUBLIC_FEED_LCD: 'LCD_OVERRIDE',
    });
    const feeds = getMachineFeeds(' MAY-KY-TU-DAC-BIET/#01 ');

    expect(feeds).toEqual({
      temperature: 'drytech.may-ky-tu-dac-biet-01-temperature',
      humidity: 'drytech.may-ky-tu-dac-biet-01-humidity',
      light: 'drytech.may-ky-tu-dac-biet-01-light',
      fanLevel: 'drytech.may-ky-tu-dac-biet-01-fan-level',
      led: 'drytech.may-ky-tu-dac-biet-01-led',
      lcd: 'drytech.may-ky-tu-dac-biet-01-lcd',
    });
  });

  it('normal: keeps canonical key format stable', async () => {
    const { getMachineFeeds } = await loadConfigModule();
    const feeds = getMachineFeeds('M-A1');

    expect(feeds).toEqual({
      temperature: 'drytech.m-a1-temperature',
      humidity: 'drytech.m-a1-humidity',
      light: 'drytech.m-a1-light',
      fanLevel: 'drytech.m-a1-fan-level',
      led: 'drytech.m-a1-led',
      lcd: 'drytech.m-a1-lcd',
    });
  });

  it('edge: lowercases the entire machine id', async () => {
    const { getMachineFeeds } = await loadConfigModule();
    const feeds = getMachineFeeds('M-A_9X');

    expect(feeds.temperature).toBe('drytech.m-a_9x-temperature');
    expect(feeds.fanLevel).toBe('drytech.m-a_9x-fan-level');
  });

  it('error: throws when machineId is invalid', async () => {
    const { getMachineFeeds } = await loadConfigModule();

    expect(() => getMachineFeeds(undefined as unknown as string)).toThrow(TypeError);
  });

  it('keeps warning thresholds stable', async () => {
    const { AIO_THRESHOLDS } = await loadConfigModule();

    expect(AIO_THRESHOLDS).toEqual({
      tempMax: 90,
      tempWarn: 82,
      humMin: 8,
      humMax: 85,
      lightDoor: 90,
    });
  });
});
