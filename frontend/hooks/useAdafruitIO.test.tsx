import { renderHook, act, waitFor } from '@testing-library/react';
import type { DeviceFeeds } from '@/config/adafruitConfig';
import { useAdafruitIO } from '@/hooks/useAdafruitIO';

const { mockFetchFeedLastValue, mockPublishFeedValue } = vi.hoisted(() => ({
  mockFetchFeedLastValue: vi.fn(),
  mockPublishFeedValue: vi.fn(),
}));

vi.mock('@/services/adafruitAPI', () => ({
  mockFetchFeedLastValue,
  mockPublishFeedValue,
}));

describe('useAdafruitIO', () => {
  const feeds: DeviceFeeds = {
    temperature: 'drytech.m-a1-temperature',
    humidity: 'drytech.m-a1-humidity',
    light: 'drytech.m-a1-light',
    fan: 'drytech.m-a1-fan',
    relay: 'drytech.m-a1-relay',
    lcd: 'drytech.m-a1-lcd',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchFeedLastValue.mockImplementation((feedKey: string) => {
      if (feedKey.includes('temperature')) return { value: '65.2', created_at: '2026-03-04T00:00:00.000Z' };
      if (feedKey.includes('humidity')) return { value: '18.4', created_at: '2026-03-04T00:00:00.000Z' };
      if (feedKey.includes('light')) return { value: '220', created_at: '2026-03-04T00:00:00.000Z' };
      if (feedKey.includes('fan')) return { value: '1', created_at: '2026-03-04T00:00:00.000Z' };
      if (feedKey.includes('relay')) return { value: '0', created_at: '2026-03-04T00:00:00.000Z' };
      return { value: 'Sẵn sàng', created_at: '2026-03-04T00:00:00.000Z' };
    });
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
      timestamp: '2026-03-04T00:00:00.000Z',
    });
    expect(result.current.output.fanOn).toBe(true);
    expect(result.current.output.relayOn).toBe(false);
    expect(result.current.output.lcdMessage).toBe('Sẵn sàng');
  });

  it('updates output immediately when sending control commands', async () => {
    const { result } = renderHook(() => useAdafruitIO(feeds));

    await waitFor(() => expect(result.current.connected).toBe(true));

    await act(async () => {
      await result.current.setFan(false);
      await result.current.setRelay(true);
      await result.current.sendLcd('Drying...');
    });

    expect(mockPublishFeedValue).toHaveBeenCalledWith(feeds.fan, '0');
    expect(mockPublishFeedValue).toHaveBeenCalledWith(feeds.relay, '1');
    expect(mockPublishFeedValue).toHaveBeenCalledWith(feeds.lcd, 'Drying...');
    expect(result.current.output).toMatchObject({
      fanOn: false,
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
