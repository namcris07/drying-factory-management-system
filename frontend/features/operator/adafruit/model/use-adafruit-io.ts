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

// ── Public Interface ──────────────────────────────────────────────────────────

export interface UseAdafruitIOReturn {
  sensor:      SensorData;   // Cảm biến mới nhất
  output:      DeviceOutput; // Trạng thái đầu ra (fan level, LED, LCD)
  history:     HistoryPoint[]; // Lịch sử đo cho biểu đồ
  loading:     boolean;
  connected:   boolean;
  errorMsg:    string | null;
  lastUpdated: Date | null;
  setFanLevel: (level: number) => Promise<void>;
  setLed:      (on: boolean) => Promise<void>;
  sendLcd:     (msg: string) => Promise<void>;
  refresh:     () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAdafruitIO(
  feeds: DeviceFeeds | null,
): UseAdafruitIOReturn {
  const [sensor,      setSensor]      = useState<SensorData>({ temperature: 0, humidity: 0, light: 0, timestamp: '' });
  const [output,      setOutput]      = useState<DeviceOutput>({ fanOn: false, ledOn: false, lcdMessage: '', fanLevel: 0 });
  const [history,     setHistory]     = useState<HistoryPoint[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [connected,   setConnected]   = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollTick,    setPollTick]    = useState(0);

  const feedsRef = useRef<DeviceFeeds | null>(feeds);
  useEffect(() => { feedsRef.current = feeds; }, [feeds]);

  // ── Poll Function ──────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    const f = feedsRef.current;
    if (!f) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [status, stateItems] = await Promise.all([
        mqttApi.getStatus(),
        mqttApi.getState(),
      ]);

      const byFeed = new Map(stateItems.map((item) => [item.feed, item.value]));

      const temperature = Number(byFeed.get(f.temperature));
      const humidity = Number(byFeed.get(f.humidity));
      const light = Number(byFeed.get(f.light));
      const fanLevelRaw = Number(byFeed.get(f.fanLevel));
      const ledRaw = byFeed.get(f.led);
      const lcdRaw = byFeed.get(f.lcd);

      const nextFanLevel = Number.isFinite(fanLevelRaw) ? Math.max(0, Math.min(100, fanLevelRaw)) : 0;

      const newSensor: SensorData = {
        temperature: Number.isFinite(temperature) ? temperature : 0,
        humidity: Number.isFinite(humidity) ? humidity : 0,
        light: Number.isFinite(light) ? light : 0,
        timestamp: new Date().toISOString(),
      };
      const newOutput: DeviceOutput = {
        fanOn: nextFanLevel > 0,
        fanLevel: nextFanLevel,
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
      setConnected(Boolean(status.connected));
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
    if (!feeds) return;
    poll();
    const id = setInterval(poll, AIO_CONFIG.pollingIntervalMs);
    return () => clearInterval(id);
  }, [feeds, poll, pollTick]);

  // ── Commands ───────────────────────────────────────────────────────────────

  const ensureCommandOk = (
    result: { ok: boolean; note?: string },
    fallbackError: string,
  ) => {
    if (!result.ok) {
      throw new Error(result.note || fallbackError);
    }
  };

  const setFanLevel = async (level: number) => {
    const f = feedsRef.current;
    if (!f) return;
    const nextLevel = Math.max(0, Math.min(100, Math.round(level)));
    const result = await mqttApi.publishCommand(f.fanLevel, nextLevel, true);
    ensureCommandOk(result, 'Khong the cap nhat muc quat.');
    setOutput(prev => ({ ...prev, fanLevel: nextLevel, fanOn: nextLevel > 0 }));
  };

  const setLed = async (on: boolean) => {
    const f = feedsRef.current;
    if (!f) return;
    const result = await mqttApi.publishCommand(f.led, on ? 1 : 0, true);
    ensureCommandOk(result, 'Khong the dieu khien LED.');
    setOutput(prev => ({ ...prev, ledOn: on }));
  };

  const sendLcd = async (msg: string) => {
    const f = feedsRef.current;
    if (!f) return;
    const result = await mqttApi.publishCommand(f.lcd, msg, true);
    ensureCommandOk(result, 'Khong the gui noi dung LCD.');
    setOutput(prev => ({ ...prev, lcdMessage: msg }));
  };

  const refresh = () => setPollTick(t => t + 1);

  return { sensor, output, history, loading, connected, errorMsg, lastUpdated, setFanLevel, setLed, sendLcd, refresh };
}
