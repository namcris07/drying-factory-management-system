import { NextRequest, NextResponse } from 'next/server';
import { SESSION_ROLE_COOKIE, UserRole, isUserRole, roleHomePath } from '@/shared/auth/session';

const MANAGER_PATHS = ['/manager', '/ai', '/batches', '/recipes', '/reports', '/ui'];

function requiredRole(pathname: string): UserRole | null {
  if (pathname.startsWith('/admin')) return 'Admin';
  if (pathname.startsWith('/operator')) return 'Operator';
  if (MANAGER_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
    return 'Manager';
  }
  return null;
}

function getRoleFromCookie(req: NextRequest): UserRole | null {
  const raw = req.cookies.get(SESSION_ROLE_COOKIE)?.value;
  if (!raw) return null;
  return isUserRole(raw) ? raw : null;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const role = getRoleFromCookie(req);
  const roleNeeded = requiredRole(pathname);

  if (pathname === '/login' && role) {
    return NextResponse.redirect(new URL(roleHomePath(role), req.url));
  }

  if (!roleNeeded) {
    return NextResponse.next();
  }

  if (!role) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (role !== roleNeeded) {
    return NextResponse.redirect(new URL(roleHomePath(role), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/admin/:path*', '/manager/:path*', '/operator/:path*', '/ai', '/batches', '/recipes', '/reports', '/ui'],
};