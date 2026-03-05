import MainLayout from '@/features/manager/layouts/ManagerShell';

/**
 * app/(manager)/layout.tsx
 * Layout cho Manager pages (sidebar xanh dương)
 */
export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
