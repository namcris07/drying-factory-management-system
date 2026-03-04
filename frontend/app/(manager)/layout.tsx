import MainLayout from '@/components/layouts/MainLayout';

/**
 * app/(manager)/layout.tsx
 * Layout cho Manager pages (sidebar xanh dương)
 */
export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}
