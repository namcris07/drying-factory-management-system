import {
  SESSION_ROLE_COOKIE,
  SESSION_STORAGE_KEY,
  clearAuthSession,
  getAuthSessionFromStorage,
  isUserRole,
  parseAuthSession,
  roleHomePath,
  setAuthSession,
} from '@/shared/auth/session';

describe('auth session helpers', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    const localStorageMock = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
    document.cookie = `${SESSION_ROLE_COOKIE}=; path=/; max-age=0`;
  });

  it('parses a valid stored session', () => {
    const parsed = parseAuthSession('{"name":"Alex","role":"Manager","zone":"Zone A"}');

    expect(parsed).toEqual({
      name: 'Alex',
      role: 'Manager',
      zone: 'Zone A',
    });
  });

  it('returns null for malformed or invalid session payloads', () => {
    expect(parseAuthSession(null)).toBeNull();
    expect(parseAuthSession('{bad-json')).toBeNull();
    expect(parseAuthSession('{"name":"Alex"}')).toBeNull();
    expect(parseAuthSession('{"name":"Alex","role":"Unknown"}')).toBeNull();
  });

  it('sets and clears session in storage and cookie', () => {
    setAuthSession({ name: 'Super Admin', role: 'Admin', zone: 'All Zones' });

    expect(globalThis.localStorage.getItem(SESSION_STORAGE_KEY)).toContain('Super Admin');
    expect(document.cookie).toContain(`${SESSION_ROLE_COOKIE}=Admin`);
    expect(getAuthSessionFromStorage()).toEqual({
      name: 'Super Admin',
      role: 'Admin',
      zone: 'All Zones',
    });

    clearAuthSession();

    expect(globalThis.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(document.cookie).not.toContain(`${SESSION_ROLE_COOKIE}=`);
    expect(getAuthSessionFromStorage()).toBeNull();
  });

  it('exposes role guards and role home paths', () => {
    expect(isUserRole('Admin')).toBe(true);
    expect(isUserRole('Manager')).toBe(true);
    expect(isUserRole('Operator')).toBe(true);
    expect(isUserRole('Viewer')).toBe(false);

    expect(roleHomePath('Admin')).toBe('/admin/users');
    expect(roleHomePath('Manager')).toBe('/manager');
    expect(roleHomePath('Operator')).toBe('/operator');
  });
});