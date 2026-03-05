"use client";

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AuthSession, UserRole, getAuthSessionFromStorage, roleHomePath } from '@/shared/auth/session';

export function useRequireRole(allowedRoles: UserRole[]): AuthSession | null {
  const router = useRouter();
  const user = useMemo(() => getAuthSessionFromStorage(), []);
  const allowedRolesKey = allowedRoles.join(',');
  const isAllowed = user ? allowedRoles.includes(user.role) : false;

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    if (!isAllowed) {
      router.replace(roleHomePath(user.role));
    }
  }, [allowedRolesKey, isAllowed, router, user]);

  return user;
}
