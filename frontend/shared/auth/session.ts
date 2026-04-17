export type UserRole = 'Admin' | 'Manager' | 'Operator';

export interface AuthSession {
  userID?: number;
  name: string;
  role: UserRole;
  zone?: string;
  zones?: { zoneID: number; zoneName: string }[];
}

export const SESSION_STORAGE_KEY = 'drytechUser';
export const SESSION_ROLE_COOKIE = 'drytechRole';

export function parseAuthSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.name || !parsed.role) return null;
    if (!isUserRole(parsed.role)) return null;
    const normalizedZones = Array.isArray(parsed.zones)
      ? parsed.zones
          .filter((z): z is { zoneID: number; zoneName: string } =>
            Number.isFinite((z as { zoneID?: unknown }).zoneID) &&
            typeof (z as { zoneName?: unknown }).zoneName === 'string',
          )
          .map((z) => ({ zoneID: Number(z.zoneID), zoneName: z.zoneName }))
      : undefined;

    return {
      ...(Number.isFinite(parsed.userID) ? { userID: Number(parsed.userID) } : {}),
      name: parsed.name,
      role: parsed.role,
      zone: parsed.zone,
      ...(normalizedZones ? { zones: normalizedZones } : {}),
    };
  } catch {
    return null;
  }
}

export function getAuthSessionFromStorage(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  return parseAuthSession(localStorage.getItem(SESSION_STORAGE_KEY));
}

export function setAuthSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  document.cookie = `${SESSION_ROLE_COOKIE}=${session.role}; path=/; max-age=${60 * 60 * 8}; samesite=lax`;
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_STORAGE_KEY);
  document.cookie = `${SESSION_ROLE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function isUserRole(value: string): value is UserRole {
  return value === 'Admin' || value === 'Manager' || value === 'Operator';
}

export function roleHomePath(role: UserRole): string {
  switch (role) {
    case 'Admin':
      return '/admin/users';
    case 'Manager':
      return '/manager';
    case 'Operator':
      return '/operator';
    default:
      return '/login';
  }
}
