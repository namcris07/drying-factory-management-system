import AdminLayout from '@/components/layouts/AdminLayout';

/**
 * app/(admin)/layout.tsx
 * Layout cho Admin pages (sidebar đỏ)
 */
export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
