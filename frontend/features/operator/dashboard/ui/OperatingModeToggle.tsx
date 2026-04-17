import React, { useState, useEffect, useRef } from 'react';
import { Switch } from '@/shared/ui/switch';
import { mqttApi, systemConfigApi } from '@/shared/lib/api';
import { MODE_FEED_KEY } from '@/features/operator/adafruit/config/adafruit-config';

interface OperatingModeToggleProps {
  onModeChange?: (mode: 'auto' | 'manual') => void;
}

export function OperatingModeToggle({
  onModeChange,
}: OperatingModeToggleProps) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLastSyncTime] = useState<Date | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load current mode on mount
  useEffect(() => {
    const loadMode = async () => {
      try {
        const response = await systemConfigApi.getAll();
        const currentMode = (response.operatingMode ?? 'auto') as
          | 'auto'
          | 'manual';
        setMode(currentMode);
        onModeChange?.(currentMode);
        setLastSyncTime(new Date());
        setError(null);
      } catch (err) {
        console.error('Failed to load operating mode:', err);
        setError('Không thể tải chế độ');
      }
    };

    loadMode();
  }, [onModeChange]);

  // Poll for mode changes every 5 seconds
  // This allows real-time sync when another user changes the mode
  useEffect(() => {
    const pollModeChanges = async () => {
      try {
        const response = await systemConfigApi.getAll();
        const currentMode = (response.operatingMode ?? 'auto') as
          | 'auto'
          | 'manual';

        // If mode changed (from another user/browser), update and notify
        if (currentMode !== mode && !isLoading) {
          setMode(currentMode);
          setLastSyncTime(new Date());
          onModeChange?.(currentMode);
        }
      } catch (err) {
        console.error('Error polling mode changes:', err);
        // Don't show error to avoid disrupting UX
      }
    };

    // Start polling
    pollingIntervalRef.current = setInterval(pollModeChanges, 5000);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [mode, isLoading, onModeChange]);

  const handleModeChange = async (newMode: 'auto' | 'manual') => {
    setIsLoading(true);
    setError(null);

    try {
      await systemConfigApi.saveAll({
        operatingMode: newMode,
      });

      const modeValue = newMode === 'auto' ? 1 : 0;
      const mqttResult = await mqttApi.publishCommand(
        MODE_FEED_KEY,
        modeValue,
        true,
      );

      if (!mqttResult.ok) {
        setError(
          'Đã cập nhật chế độ trong hệ thống nhưng chưa đẩy được lên feed Mode.',
        );
      }

      setMode(newMode);
      setLastSyncTime(new Date());
      onModeChange?.(newMode);
    } catch (err) {
      console.error('Failed to change operating mode:', err);
      setError('Không thể thay đổi chế độ');
      // Revert to previous mode
      setMode(mode);
    } finally {
      setIsLoading(false);
    }
  };

  const isAuto = mode === 'auto';

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Status Indicator Light */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full transition-colors ${
              isAuto ? 'bg-green-500' : 'bg-gray-400'
            }`}
          />
          <span className="text-xs font-medium text-gray-600">
            Tự động: {isAuto ? 'Bật' : 'Tắt'}
          </span>
        </div>
        <Switch
          checked={isAuto}
          onCheckedChange={(checked) => {
            handleModeChange(checked ? 'auto' : 'manual');
          }}
          disabled={isLoading}
          className="ml-2"
        />
      </div>
      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded">
          {error}
        </div>
      )}
      {/* Loading State */}
      {isLoading && (
        <div className="text-xs text-blue-600 mt-2">Đang cập nhật...</div>
      )}
    </div>
  );
}

export default OperatingModeToggle;
