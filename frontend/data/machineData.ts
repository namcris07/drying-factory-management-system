/**
 * data/machineData.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * NGUỒN SỰ THẬT (Source of Truth) cho dữ liệu Máy sấy & Công thức.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Machine {
  id: string;
  name: string;
  zone: string;
  status: 'Running' | 'Idle' | 'Error' | 'Maintenance';
  recipe?: string;
  recipeId?: number;
  progress?: number;
  temp?: number;
  humidity?: number;
  startTime?: string;
  errorCode?: string;
  errorMsg?: string;
  doorOpen?: boolean;
  errorAcked?: boolean;
}

export interface Recipe {
  id: number;
  name: string;
  fruit: string;
  temp: number;
  humidity: number;
  duration: number;
}

// ── Công thức mẫu ──────────────────────────────────────────────────────────
export const recipes: Recipe[] = [
  { id: 1, name: 'Xoài sấy dẻo',      fruit: 'Xoài',      temp: 65, humidity: 18, duration: 8  },
  { id: 2, name: 'Chuối sấy giòn',     fruit: 'Chuối',     temp: 70, humidity: 15, duration: 6  },
  { id: 3, name: 'Dứa sấy dẻo',        fruit: 'Dứa',       temp: 60, humidity: 20, duration: 10 },
  { id: 4, name: 'Táo sấy lát mỏng',   fruit: 'Táo',       temp: 55, humidity: 12, duration: 7  },
  { id: 5, name: 'Khoai lang sấy',     fruit: 'Khoai lang', temp: 75, humidity: 10, duration: 5  },
  { id: 6, name: 'Mít sấy khô',        fruit: 'Mít',       temp: 58, humidity: 16, duration: 12 },
];

// ── Danh sách máy ban đầu ──────────────────────────────────────────────────
export const initialMachines: Machine[] = [
  { id: 'M-A1', name: 'Máy sấy A1', zone: 'Zone A', status: 'Running',     recipe: 'Xoài sấy dẻo',    recipeId: 1, progress: 68, temp: 65, humidity: 19, startTime: '08:00', doorOpen: false },
  { id: 'M-A2', name: 'Máy sấy A2', zone: 'Zone A', status: 'Idle',        temp: 28, humidity: 72 },
  { id: 'M-A3', name: 'Máy sấy A3', zone: 'Zone A', status: 'Running',     recipe: 'Dứa sấy dẻo',     recipeId: 3, progress: 45, temp: 60, humidity: 22, startTime: '09:30', doorOpen: false },
  { id: 'M-A4', name: 'Máy sấy A4', zone: 'Zone A', status: 'Maintenance', temp: 25, humidity: 68 },
  { id: 'M-B1', name: 'Máy sấy B1', zone: 'Zone B', status: 'Running',     recipe: 'Xoài sấy dẻo',    recipeId: 1, progress: 82, temp: 64, humidity: 17, startTime: '07:00', doorOpen: false },
  { id: 'M-B2', name: 'Máy sấy B2', zone: 'Zone B', status: 'Error',       errorCode: 'ERR-HT-04', errorMsg: 'Cảm biến nhiệt độ Zone B - Unit 4 mất kết nối. Kiểm tra dây điện cảm biến.', temp: 42, humidity: 55, errorAcked: false },
  { id: 'M-B3', name: 'Máy sấy B3', zone: 'Zone B', status: 'Idle',        temp: 27, humidity: 70 },
  { id: 'M-C1', name: 'Máy sấy C1', zone: 'Zone C', status: 'Running',     recipe: 'Táo sấy lát mỏng', recipeId: 4, progress: 30, temp: 55, humidity: 24, startTime: '10:00', doorOpen: false },
  { id: 'M-C2', name: 'Máy sấy C2', zone: 'Zone C', status: 'Running',     recipe: 'Mít sấy khô',      recipeId: 6, progress: 55, temp: 58, humidity: 18, startTime: '08:30', doorOpen: true  },
  { id: 'M-D1', name: 'Máy sấy D1', zone: 'Zone D', status: 'Idle',        temp: 26, humidity: 65 },
  { id: 'M-D2', name: 'Máy sấy D2', zone: 'Zone D', status: 'Running',     recipe: 'Chuối sấy giòn',   recipeId: 2, progress: 90, temp: 70, humidity: 14, startTime: '06:00', doorOpen: false },
  { id: 'M-D3', name: 'Máy sấy D3', zone: 'Zone D', status: 'Idle',        temp: 27, humidity: 67 },
];
