"use client";

/**
 * hooks/useAdafruitIO.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React Hook quản lý vòng đời dữ liệu Adafruit IO cho một thiết bị.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceFeeds, AIO_CONFIG } from '@/features/operator/adafruit/config/adafruit-config';
import {
  SensorData,
  DeviceOutput,
  HistoryPoint,
  mockFetchFeedLastValue,
  mockPublishFeedValue,
} from '@/features/operator/adafruit/api/adafruit-api';

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
  setRelay:    (on: boolean) => Promise<void>;
  sendLcd:     (msg: string) => Promise<void>;
  refresh:     () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAdafruitIO(
  feeds: DeviceFeeds | null,
  opts?: { targetTemp?: number; targetHum?: number },
): UseAdafruitIOReturn {
  const [sensor,      setSensor]      = useState<SensorData>({ temperature: 0, humidity: 0, light: 0, timestamp: '' });
  const [output,      setOutput]      = useState<DeviceOutput>({ fanOn: false, relayOn: false, lcdMessage: '' });
  const [history,     setHistory]     = useState<HistoryPoint[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [connected,   setConnected]   = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollTick,    setPollTick]    = useState(0);

  const feedsRef = useRef<DeviceFeeds | null>(feeds);
  const optsRef  = useRef(opts);
  useEffect(() => { feedsRef.current = feeds; }, [feeds]);
  useEffect(() => { optsRef.current  = opts;  }, [opts]);

  // ── Poll Function ──────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    const f = feedsRef.current;
    if (!f) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const tData = mockFetchFeedLastValue(f.temperature, { targetTemp: optsRef.current?.targetTemp });
      const hData = mockFetchFeedLastValue(f.humidity,    { targetHum:  optsRef.current?.targetHum  });
      const lData = mockFetchFeedLastValue(f.light);
      const fData = mockFetchFeedLastValue(f.fan);
      const rData = mockFetchFeedLastValue(f.relay);
      const mData = mockFetchFeedLastValue(f.lcd);

      const newSensor: SensorData = {
        temperature: parseFloat(tData.value),
        humidity:    parseFloat(hData.value),
        light:       parseInt(lData.value),
        timestamp:   tData.created_at,
      };
      const newOutput: DeviceOutput = {
        fanOn:      fData.value === '1',
        relayOn:    rData.value === '1',
        lcdMessage: mData.value,
      };
      const now     = new Date();
      const timeStr = now.toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setSensor(newSensor);
      setOutput(newOutput);
      setHistory(prev => [
        ...prev.slice(-(MAX_HISTORY - 1)),
        { time: timeStr, temperature: newSensor.temperature, humidity: newSensor.humidity, light: newSensor.light },
      ]);
      setConnected(true);
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
    mockPublishFeedValue(f.fan, on ? '1' : '0');
    setOutput(prev => ({ ...prev, fanOn: on }));
  };

  const setRelay = async (on: boolean) => {
    const f = feedsRef.current;
    if (!f) return;
    mockPublishFeedValue(f.relay, on ? '1' : '0');
    setOutput(prev => ({ ...prev, relayOn: on }));
  };

  const sendLcd = async (msg: string) => {
    const f = feedsRef.current;
    if (!f) return;
    mockPublishFeedValue(f.lcd, msg);
    setOutput(prev => ({ ...prev, lcdMessage: msg }));
  };

  const refresh = () => setPollTick(t => t + 1);

  return { sensor, output, history, loading, connected, errorMsg, lastUpdated, setFan, setRelay, sendLcd, refresh };
}
