import {
  fetchFeedHistory,
  fetchFeedLastValue,
  getMockStoreSnapshot,
  mockFetchFeedLastValue,
  mockPublishFeedValue,
  publishFeedValue,
} from '@/features/operator/adafruit/api/adafruit-api';

describe('adafruitAPI mock engine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes and updates temperature values in a bounded range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const feedKey = `test-temperature-${Date.now()}`;

    const first = mockFetchFeedLastValue(feedKey, { targetTemp: 65 });
    const second = mockFetchFeedLastValue(feedKey, { targetTemp: 65 });

    expect(Number(first.value)).toBeGreaterThanOrEqual(30);
    expect(Number(first.value)).toBeLessThanOrEqual(95);
    expect(Number(second.value)).toBeGreaterThanOrEqual(30);
    expect(Number(second.value)).toBeLessThanOrEqual(95);
  });

  it('writes values to mock store via publish', () => {
    const feedKey = `test-fan-${Date.now()}`;

    const published = mockPublishFeedValue(feedKey, '1');
    const snapshot = getMockStoreSnapshot();

    expect(published.feed_key).toBe(feedKey);
    expect(published.value).toBe('1');
    expect(snapshot[feedKey]).toBe('1');
  });

  it('returns snapshot as a copy to avoid accidental mutation', () => {
    const feedKey = `test-relay-${Date.now()}`;
    mockPublishFeedValue(feedKey, '0');

    const snapshot = getMockStoreSnapshot();
    snapshot[feedKey] = '999';

    const nextSnapshot = getMockStoreSnapshot();
    expect(nextSnapshot[feedKey]).toBe('0');
  });
});

describe('adafruitAPI real fetch wrappers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws a descriptive error when last-value endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(fetchFeedLastValue('temperature')).rejects.toThrow('[AIO] GET last failed');
  });

  it('throws a descriptive error when publish endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );

    await expect(publishFeedValue('fan', 1)).rejects.toThrow('[AIO] POST failed');
  });

  it('parses JSON response for history endpoint', async () => {
    const payload = [{ id: '1', value: '42' }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(payload),
      }),
    );

    await expect(fetchFeedHistory('humidity', 3)).resolves.toEqual(payload);
  });
});
