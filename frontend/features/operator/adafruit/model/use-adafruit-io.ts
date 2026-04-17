"use client";

/**
 * hooks/useAdafruitIO.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React Hook quản lý vòng đời dữ liệu Adafruit IO cho một thiết bị.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceFeeds, AIO_CONFIG } from '@/features/operator/adafruit/config/adafruit-config';
import { DeviceOutput, HistoryPoint, SensorData } from '@/features/operator/adafruit/api/adafruit-api';
import { mqttApi } from '@/shared/lib/api';

const MAX_HISTORY = 30;

type UseAdafruitIOOptions = {
  averageFeeds?: string[];
  tempFaultRange?: { min: number; max: number };
};

function normalizeFeedName(feed: string): string {
  return String(feed ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Public Interface ──────────────────────────────────────────────────────────

export interface UseAdafruitIOReturn {
  sensor:      SensorData;   // Cảm biến mới nhất
  output:      DeviceOutput; // Trạng thái đầu ra (fan level, LED, LCD)
  history:     HistoryPoint[]; // Lịch sử đo cho biểu đồ
  loading:     boolean;
  connected:   boolean;
  errorMsg:    string | null;
  lastUpdated: Date | null;
  setFanLevel: (level: number) => Promise<boolean>;
  setLed:      (on: boolean) => Promise<boolean>;
  sendLcd:     (msg: string) => Promise<boolean>;
  refresh:     () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAdafruitIO(
  feeds: DeviceFeeds | null,
  options?: UseAdafruitIOOptions,
): UseAdafruitIOReturn {
  const [sensor,      setSensor]      = useState<SensorData>({ temperature: 0, humidity: 0, light: 0, timestamp: '' });
  const [output,      setOutput]      = useState<DeviceOutput>({ fanOn: false, ledOn: false, lcdMessage: '', fanLevel: 0 });
  const [history,     setHistory]     = useState<HistoryPoint[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [connected,   setConnected]   = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollTick,    setPollTick]    = useState(0);
  const feedSignature = feeds
    ? [feeds.temperature, feeds.humidity, feeds.light, feeds.fanLevel, feeds.led, feeds.lcd].join('|')
    : '';

  const feedsRef = useRef<DeviceFeeds | null>(feeds);
  const averageFeedsRef = useRef<string[]>(options?.averageFeeds ?? []);
  const tempFaultRangeRef = useRef<{ min: number; max: number } | null>(
    options?.tempFaultRange ?? null,
  );
  useEffect(() => { feedsRef.current = feeds; }, [feeds]);
  useEffect(() => {
    averageFeedsRef.current = options?.averageFeeds ?? [];
    tempFaultRangeRef.current = options?.tempFaultRange ?? null;
  }, [options?.averageFeeds, options?.tempFaultRange]);

  // ── Poll Function ──────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    const f = feedsRef.current;
    setLoading(true);
    setErrorMsg(null);
    try {
      const status = await mqttApi.getStatus();
      setConnected(Boolean(status.connected));

      if (!f) {
        setLastUpdated(new Date());
        return;
      }

      const stateItems = await mqttApi.getState();

      const byFeed = new Map(stateItems.map((item) => [item.feed, item.value]));
      const byNormalizedFeed = new Map(
        stateItems.map((item) => [normalizeFeedName(item.feed), item.value]),
      );

      const aggregateFeeds = averageFeedsRef.current;
      const tempFaultRange = tempFaultRangeRef.current;

      const collectAverage = (
        tokens: string[],
        validator?: (value: number) => boolean,
      ): number | null => {
        if (!aggregateFeeds.length) return null;

        const values = aggregateFeeds
          .filter((feed) => {
            const normalized = normalizeFeedName(feed);
            return tokens.some((token) => normalized.includes(token));
          })
          .map((feed) => {
            const exactValue = byFeed.get(feed);
            if (exactValue !== undefined) return Number(exactValue);
            return Number(byNormalizedFeed.get(normalizeFeedName(feed)));
          })
          .filter((value) => Number.isFinite(value))
          .filter((value) => (validator ? validator(value) : true));

        if (values.length === 0) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      };

      const temperature = Number(byFeed.get(f.temperature));
      const humidity = Number(byFeed.get(f.humidity));
      const light = Number(byFeed.get(f.light));
      const fanLevelRaw = Number(byFeed.get(f.fanLevel));
      const ledRaw = byFeed.get(f.led);
      const lcdRaw = byFeed.get(f.lcd);

      const averageTemperature = collectAverage(['temp', 'temperature'], (value) => {
        if (!tempFaultRange) return true;
        return value >= tempFaultRange.min && value <= tempFaultRange.max;
      });
      const averageHumidity = collectAverage(['humid', 'humidity']);

      const newSensor: SensorData = {
        temperature: averageTemperature !== null
          ? averageTemperature
          : Number.isFinite(temperature)
            ? temperature
            : 0,
        humidity: averageHumidity !== null
          ? averageHumidity
          : Number.isFinite(humidity)
            ? humidity
            : 0,
        light: Number.isFinite(light) ? light : 0,
        timestamp: new Date().toISOString(),
      };
      const newOutput: DeviceOutput = {
        fanLevel: Number.isFinite(fanLevelRaw) ? fanLevelRaw : 0,
        fanOn: Number.isFinite(fanLevelRaw) ? fanLevelRaw > 0 : false,
        ledOn:
          ledRaw === '1' ||
          ledRaw === 1 ||
          ledRaw === true ||
          String(ledRaw).toUpperCase() === 'ON',
        lcdMessage: typeof lcdRaw === 'string' ? lcdRaw : '',
      };
      const now     = new Date();
      const timeStr = now.toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setSensor(newSensor);
      setOutput(newOutput);
      setHistory(prev => [
        ...prev.slice(-(MAX_HISTORY - 1)),
        { time: timeStr, temperature: newSensor.temperature, humidity: newSensor.humidity, light: newSensor.light },
      ]);
      setLastUpdated(now);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối Adafruit IO');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Polling Effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    poll();
    const id = setInterval(poll, AIO_CONFIG.pollingIntervalMs);
    return () => clearInterval(id);
  }, [feedSignature, poll, pollTick]);

  // ── Commands ───────────────────────────────────────────────────────────────

  const setFanLevel = async (level: number): Promise<boolean> => {
    const f = feedsRef.current;
    if (!f) return false;
    const nextLevel = Math.max(0, Math.min(100, Math.round(level)));
    const result = await mqttApi.publishCommand(f.fanLevel, nextLevel, true);
    if (!result.ok) {
      setErrorMsg(result.note ?? 'Không thể đồng bộ lệnh quạt lên Adafruit IO.');
      return false;
    }
    setOutput(prev => ({ ...prev, fanLevel: nextLevel, fanOn: nextLevel > 0 }));
    setErrorMsg(null);
    return true;
  };

  const setLed = async (on: boolean): Promise<boolean> => {
    const f = feedsRef.current;
    if (!f) return false;
    const result = await mqttApi.publishCommand(f.led, on ? 1 : 0, true);
    if (!result.ok) {
      setErrorMsg(result.note ?? 'Không thể đồng bộ lệnh LED lên Adafruit IO.');
      return false;
    }
    setOutput(prev => ({ ...prev, ledOn: on }));
    setErrorMsg(null);
    return true;
  };

  const sendLcd = async (msg: string): Promise<boolean> => {
    const f = feedsRef.current;
    if (!f) return false;
    const result = await mqttApi.publishCommand(f.lcd, msg, true);
    if (!result.ok) {
      setErrorMsg(result.note ?? 'Không thể đồng bộ nội dung LCD lên Adafruit IO.');
      return false;
    }
    setOutput(prev => ({ ...prev, lcdMessage: msg }));
    setErrorMsg(null);
    return true;
  };

  const refresh = () => setPollTick(t => t + 1);

  return { sensor, output, history, loading, connected, errorMsg, lastUpdated, setFanLevel, setLed, sendLcd, refresh };
}
