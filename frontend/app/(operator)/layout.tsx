import OperatorLayout from '@/features/operator/layouts/OperatorShell';

/**
 * app/(operator)/layout.tsx
 * Layout cho Operator pages (sidebar xanh lá)
 */
export default function OperatorRouteLayout({ children }: { children: React.ReactNode }) {
  return <OperatorLayout>{children}</OperatorLayout>;
}
