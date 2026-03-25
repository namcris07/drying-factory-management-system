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
  output:      DeviceOutput; // Trạng thái đầu ra (fan, relay, LCD)
  history:     HistoryPoint[]; // Lịch sử đo cho biểu đồ
  loading:     boolean;
  connected:   boolean;
  errorMsg:    string | null;
  lastUpdated: Date | null;
  setFan:      (on: boolean) => Promise<void>;
  setFanLevel: (level: number) => Promise<void>;
  setRelay:    (on: boolean) => Promise<void>;
  sendLcd:     (msg: string) => Promise<void>;
  refresh:     () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAdafruitIO(
  feeds: DeviceFeeds | null,
): UseAdafruitIOReturn {
  const [sensor,      setSensor]      = useState<SensorData>({ temperature: 0, humidity: 0, light: 0, timestamp: '' });
  const [output,      setOutput]      = useState<DeviceOutput>({ fanOn: false, relayOn: false, lcdMessage: '', fanLevel: 0 });
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
      const fanRaw = byFeed.get(f.fan);
      const relayRaw = byFeed.get(f.relay);
      const fanLevelRaw = Number(byFeed.get(f.fanLevel));
      const lcdRaw = byFeed.get(f.lcd);

      const newSensor: SensorData = {
        temperature: Number.isFinite(temperature) ? temperature : 0,
        humidity: Number.isFinite(humidity) ? humidity : 0,
        light: Number.isFinite(light) ? light : 0,
        timestamp: new Date().toISOString(),
      };
      const newOutput: DeviceOutput = {
        fanOn:
          fanRaw === '1' ||
          fanRaw === 1 ||
          fanRaw === true ||
          String(fanRaw).toUpperCase() === 'ON',
        fanLevel: Number.isFinite(fanLevelRaw) ? fanLevelRaw : 0,
        relayOn:
          relayRaw === '1' ||
          relayRaw === 1 ||
          relayRaw === true ||
          String(relayRaw).toUpperCase() === 'ON',
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

  const setFan = async (on: boolean) => {
    const f = feedsRef.current;
    if (!f) return;
    await mqttApi.publishCommand(f.fan, on ? 1 : 0, true);
    setOutput(prev => ({ ...prev, fanOn: on }));
  };

  const setFanLevel = async (level: number) => {
    const f = feedsRef.current;
    if (!f) return;
    const nextLevel = Math.max(0, Math.min(5, Math.round(level)));
    await mqttApi.publishCommand(f.fanLevel, nextLevel, true);
    setOutput(prev => ({ ...prev, fanLevel: nextLevel }));
  };

  const setRelay = async (on: boolean) => {
    const f = feedsRef.current;
    if (!f) return;
    await mqttApi.publishCommand(f.relay, on ? 1 : 0, true);
    setOutput(prev => ({ ...prev, relayOn: on }));
  };

  const sendLcd = async (msg: string) => {
    const f = feedsRef.current;
    if (!f) return;
    await mqttApi.publishCommand(f.lcd, msg, true);
    setOutput(prev => ({ ...prev, lcdMessage: msg }));
  };

  const refresh = () => setPollTick(t => t + 1);

  return { sensor, output, history, loading, connected, errorMsg, lastUpdated, setFan, setFanLevel, setRelay, sendLcd, refresh };
}
