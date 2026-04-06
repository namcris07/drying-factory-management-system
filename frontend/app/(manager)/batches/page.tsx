import { Suspense } from 'react';
import BatchesPage from '@/features/manager/batches/ui/BatchesPage';

export default function ManagerBatchesPageRoute() {
	return (
		<Suspense fallback={<div style={{ padding: 24 }}>Đang tải...</div>}>
			<BatchesPage />
		</Suspense>
	);
}
