import { renderHook, waitFor } from '@testing-library/react';
import { useRequireRole } from '@/shared/auth/useRequireRole';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockReplace, mockGetAuthSessionFromStorage, mockRoleHomePath } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockGetAuthSessionFromStorage: vi.fn(),
  mockRoleHomePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

vi.mock('@/shared/auth/session', () => ({
  getAuthSessionFromStorage: mockGetAuthSessionFromStorage,
  roleHomePath: mockRoleHomePath,
}));

describe('useRequireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normal: keeps user when role is allowed', async () => {
    const user = {
      name: 'Operator A',
      role: 'Operator',
      zone: 'Zone A',
    };

    mockGetAuthSessionFromStorage.mockReturnValue(user);

    const { result } = renderHook(() => useRequireRole(['Operator']));

    await waitFor(() => {
      expect(result.current).toEqual(user);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  it('edge: redirects to login when no session exists', async () => {
    mockGetAuthSessionFromStorage.mockReturnValue(null);

    renderHook(() => useRequireRole(['Operator']));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('error: redirects unauthorized user to its role home', async () => {
    mockGetAuthSessionFromStorage.mockReturnValue({
      name: 'Admin A',
      role: 'Admin',
      zone: 'Zone A',
    });
    mockRoleHomePath.mockReturnValue('/admin');

    renderHook(() => useRequireRole(['Operator']));

    await waitFor(() => {
      expect(mockRoleHomePath).toHaveBeenCalledWith('Admin');
      expect(mockReplace).toHaveBeenCalledWith('/admin');
    });
  });
});
