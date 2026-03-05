export type UserRole = 'Admin' | 'Manager' | 'Operator';

export interface AuthSession {
  name: string;
  role: UserRole;
  zone?: string;
}

export const SESSION_STORAGE_KEY = 'drytechUser';
export const SESSION_ROLE_COOKIE = 'drytechRole';

export function parseAuthSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.name || !parsed.role) return null;
    if (!isUserRole(parsed.role)) return null;
    return {
      name: parsed.name,
      role: parsed.role,
      zone: parsed.zone,
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
