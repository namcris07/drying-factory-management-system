import {
  fetchFeedHistory,
  fetchFeedLastValue,
  publishFeedValue,
} from '@/features/operator/adafruit/api/adafruit-api';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('adafruit-api', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('normal: fetchFeedLastValue returns parsed data when response is ok', async () => {
    const payload = {
      id: '1',
      value: '21.5',
      feed_id: 10,
      feed_key: 'BBC_TEMP',
      created_at: new Date().toISOString(),
      lat: null,
      lon: null,
      ele: null,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);

    const result = await fetchFeedLastValue('BBC_TEMP');

    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('edge: fetchFeedHistory forwards custom limit query', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await fetchFeedHistory('Humidity', 5);

    const calledUrl = String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(calledUrl).toContain('/feeds/Humidity/data?limit=5');
  });

  it('error: fetchFeedLastValue throws when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchFeedLastValue('BBC_TEMP')).rejects.toThrow('[AIO] GET last failed');
  });

  it('normal: publishFeedValue posts stringified value', async () => {
    const payload = {
      id: '2',
      value: '1',
      feed_id: 11,
      feed_key: 'fan_level',
      created_at: new Date().toISOString(),
      lat: null,
      lon: null,
      ele: null,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response);

    const result = await publishFeedValue('fan_level', 1);

    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/feeds/fan_level/data'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ value: '1' }),
      }),
    );
  });

  it('error: publishFeedValue throws when post fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    } as Response);

    await expect(publishFeedValue('fan_level', 0)).rejects.toThrow('[AIO] POST failed');
  });
});
