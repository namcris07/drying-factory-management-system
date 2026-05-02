/**
 * data/machineData.ts
 * Shared domain types cho Operator pages.
 * Thiết kế channel-based: không giới hạn cứng sensor hay actuator theo loại.
 */

export interface SensorState {
  feed: string;
  sensorName?: string;
  sensorType: string;
  value: unknown;
  updatedAt: string | null;
  unit?: string;
}

export interface ActuatorState {
  feed: string;
  actuatorName?: string;
  actuatorType: string;
  value: unknown;
  updatedAt: string | null;
  /** controlMode: 'toggle' | 'level' | 'custom' */
  controlMode?: string;
  onValue?: string;
  offValue?: string;
}

export interface Machine {
  id: string;
  deviceID?: number;
  name: string;
  zone: string;
  zoneID?: number;
  deviceType?: string;
  deviceStatusRaw?: string;
  status: 'Running' | 'Idle' | 'Error' | 'Maintenance';
  recipe?: string;
  recipeId?: number;
  progress?: number;
  /** Nhiệt độ tổng hợp (từ sensor temperature trung bình) */
  temp?: number;
  /** Độ ẩm tổng hợp (từ sensor humidity trung bình) */
  humidity?: number;
  startTime?: string;
  errorCode?: string;
  errorMsg?: string;
  doorOpen?: boolean;
  errorAcked?: boolean;
  /** Feed keys của sensor (backward compat) */
  sensorFeeds?: string[];
  /** Trạng thái từng sensor channel */
  sensorState?: SensorState[];
  /** Trạng thái từng actuator channel */
  actuatorState?: ActuatorState[];
}

export interface Recipe {
  id: number;
  name: string;
  fruit: string;
  temp: number;
  humidity: number;
  duration: number;
}
