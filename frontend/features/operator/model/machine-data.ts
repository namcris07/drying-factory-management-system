/**
 * data/machineData.ts
 * Shared domain types cho Operator pages.
 */

export interface Machine {
  id: string;
  deviceID?: number;
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
  sensorFeeds?: string[];
  sensorState?: {
    feed: string;
    sensorType: string;
    value: unknown;
    updatedAt: string | null;
  }[];
}

export interface Recipe {
  id: number;
  name: string;
  fruit: string;
  temp: number;
  humidity: number;
  duration: number;
}
