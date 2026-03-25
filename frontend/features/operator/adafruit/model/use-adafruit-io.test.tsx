import { renderHook, act, waitFor } from '@testing-library/react';
import type { DeviceFeeds } from '@/features/operator/adafruit/config/adafruit-config';
import { useAdafruitIO } from '@/features/operator/adafruit/model/use-adafruit-io';

const {
  mockGetStatus,
  mockGetState,
  mockPublishCommand,
} = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
  mockGetState: vi.fn(),
  mockPublishCommand: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => ({
  mqttApi: {
    getStatus: mockGetStatus,
    getState: mockGetState,
    publishCommand: mockPublishCommand,
  },
}));

describe('useAdafruitIO', () => {
  const feeds: DeviceFeeds = {
    temperature: 'drytech.m-a1-temperature',
    humidity: 'drytech.m-a1-humidity',
    light: 'drytech.m-a1-light',
    fan: 'drytech.m-a1-fan',
    fanLevel: 'drytech.m-a1-fan-level',
    relay: 'drytech.m-a1-relay',
    lcd: 'drytech.m-a1-lcd',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatus.mockResolvedValue({ connected: true });
    mockGetState.mockResolvedValue([
      { feed: feeds.temperature, value: 65.2 },
      { feed: feeds.humidity, value: 18.4 },
      { feed: feeds.light, value: 220 },
      { feed: feeds.fan, value: '1' },
      { feed: feeds.fanLevel, value: 3 },
      { feed: feeds.relay, value: '0' },
      { feed: feeds.lcd, value: 'Sẵn sàng' },
    ]);
    mockPublishCommand.mockResolvedValue({ ok: true });
  });

  it('polls data and updates sensor/output/connection state', async () => {
    const { result } = renderHook(() => useAdafruitIO(feeds));

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
      expect(result.current.history.length).toBe(1);
    });

    expect(result.current.sensor).toEqual({
      temperature: 65.2,
      humidity: 18.4,
      light: 220,
      timestamp: expect.any(String),
    });
    expect(result.current.output.fanOn).toBe(true);
    expect(result.current.output.fanLevel).toBe(3);
    expect(result.current.output.relayOn).toBe(false);
    expect(result.current.output.lcdMessage).toBe('Sẵn sàng');
  });

  it('updates output immediately when sending control commands', async () => {
    const { result } = renderHook(() => useAdafruitIO(feeds));

    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.setFan(false);
      await result.current.setFanLevel(4);
      await result.current.setRelay(true);
      await result.current.sendLcd('Drying...');
    });

    expect(mockPublishCommand).toHaveBeenCalledWith(feeds.fan, 0, true);
    expect(mockPublishCommand).toHaveBeenCalledWith(feeds.fanLevel, 4, true);
    expect(mockPublishCommand).toHaveBeenCalledWith(feeds.relay, 1, true);
    expect(mockPublishCommand).toHaveBeenCalledWith(feeds.lcd, 'Drying...', true);
    expect(result.current.output).toMatchObject({
      fanOn: false,
      fanLevel: 4,
      relayOn: true,
      lcdMessage: 'Drying...',
    });
  });

  it('limits history size to 30 points after repeated refresh', async () => {
    const { result } = renderHook(() => useAdafruitIO(feeds));

    await waitFor(() => expect(result.current.history.length).toBe(1));

    for (let i = 0; i < 35; i += 1) {
      await act(async () => {
        result.current.refresh();
      });
    }

    await waitFor(() => expect(result.current.history.length).toBe(30));
  });
});
