import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperatingModeToggle } from './OperatingModeToggle';

const { mockGetAll, mockSaveAll, mockPublishCommand } = vi.hoisted(() => ({
  mockGetAll: vi.fn(),
  mockSaveAll: vi.fn(),
  mockPublishCommand: vi.fn(),
}));

vi.mock('@/shared/lib/api', () => ({
  systemConfigApi: {
    getAll: mockGetAll,
    saveAll: mockSaveAll,
  },
  mqttApi: {
    publishCommand: mockPublishCommand,
  },
}));

describe('OperatingModeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue({ operatingMode: 'auto' });
    mockSaveAll.mockResolvedValue({ operatingMode: 'manual' });
    mockPublishCommand.mockResolvedValue({ ok: true });
  });

  it('notifies parent with initial mode after loading', async () => {
    const onModeChange = vi.fn();

    render(<OperatingModeToggle onModeChange={onModeChange} />);

    await waitFor(() => {
      expect(onModeChange).toHaveBeenCalledWith('auto');
    });
  });

  it('saves and publishes MODE feed when switched to manual', async () => {
    render(<OperatingModeToggle />);

    await waitFor(() => {
      expect(screen.getByText(/Tự động:\s*Bật/i)).toBeTruthy();
    });

    const switchButton = screen.getByRole('switch');
    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(mockSaveAll).toHaveBeenCalledWith({ operatingMode: 'manual' });
      expect(mockPublishCommand).toHaveBeenCalledWith('mode_state', 0, true);
    });
  });
});
