import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import RealTimeMonitoringPage from './RealtimeMonitoringPage';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  window.getComputedStyle = vi.fn().mockImplementation(() => ({
    getPropertyValue: () => '',
  })) as unknown as typeof window.getComputedStyle;
});

vi.mock('@/features/operator/model/operator-context', () => ({
  useOperatorContext: () => ({
    zone: 'Zone A',
    machines: [
      {
        id: 'M-A1',
        name: 'May A1',
        zone: 'Zone A',
        status: 'Running',
        temp: 62,
        humidity: 48,
        sensorState: [
          { feed: 'm-a1/temperature', sensorType: 'temperature', value: 62, updatedAt: null },
          { feed: 'm-a1/humidity', sensorType: 'humidity', value: 48, updatedAt: null },
          { feed: 'm-a1/vibration', sensorType: 'custom', value: 8.5, updatedAt: null },
        ],
      },
    ],
  }),
}));

describe('RealtimeMonitoringPage', () => {
  it('renders dynamic sensor tags from machine sensorState', async () => {
    render(<RealTimeMonitoringPage />);

    expect(await screen.findByText(/Nhiet do:/i)).toBeTruthy();
    expect(await screen.findByText(/Do am:/i)).toBeTruthy();
    expect(await screen.findByText(/m-a1\/vibration:/i)).toBeTruthy();
  });
});
