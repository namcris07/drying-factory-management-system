/**
 * shared/lib/api.ts
 * Centralized API client for NestJS backend.
 * All HTTP requests go through this module.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ id: number; name: string; role: string; zone: string; email: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
};

// ── Users ─────────────────────────────────────────────────────────────────
export type ApiUser = {
  userID: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  createdAt: string | null;
  zones: { zoneID: number; zoneName: string | null }[];
};

export const usersApi = {
  getAll: () => request<ApiUser[]>('/users'),
  getOne: (id: number) => request<ApiUser>(`/users/${id}`),
  create: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
  }) => request<ApiUser>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: number,
    data: Partial<{ firstName: string; lastName: string; email: string; role: string; status: string; password: string }>,
  ) => request<ApiUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
};

// ── Zones ─────────────────────────────────────────────────────────────────
export type ApiZone = {
  zoneID: number;
  zoneName: string | null;
  zoneDescription: string | null;
  userID: number | null;
  devices: { deviceID: number }[];
};

export const zonesApi = {
  getAll: () => request<ApiZone[]>('/zones'),
  create: (data: { zoneName: string; zoneDescription?: string }) =>
    request<ApiZone>('/zones', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{ zoneName: string; zoneDescription: string }>) =>
    request<ApiZone>(`/zones/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/zones/${id}`, { method: 'DELETE' }),
};

// ── Devices ───────────────────────────────────────────────────────────────
export type ApiDevice = {
  deviceID: number;
  deviceName: string | null;
  deviceStatus: string | null;
  deviceType: string | null;
  mqttTopicSensor: string | null;
  mqttTopicCmd: string | null;
  zoneID: number | null;
  zone: { zoneID: number; zoneName: string | null } | null;
  metaData: Record<string, unknown> | null;
};

export const devicesApi = {
  getAll: () => request<ApiDevice[]>('/devices'),
  create: (data: Partial<ApiDevice>) =>
    request<ApiDevice>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ApiDevice>) =>
    request<ApiDevice>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/devices/${id}`, { method: 'DELETE' }),
};

// ── Recipes ───────────────────────────────────────────────────────────────
export type ApiRecipeStep = {
  stepID: number;
  stepNo: number | null;
  temperatureGoal: number | null;
  humidityGoal: number | null;
  durationMinutes: number | null;
  fanStatus: string | null;
};

export type ApiRecipe = {
  recipeID: number;
  recipeName: string | null;
  recipeFruits: string | null;
  timeDurationEst: number | null;
  userID: number | null;
  steps: ApiRecipeStep[];
};

export const recipesApi = {
  getAll: () => request<ApiRecipe[]>('/recipes'),
  getOne: (id: number) => request<ApiRecipe>(`/recipes/${id}`),
  create: (data: { recipeName: string; recipeFruits?: string; timeDurationEst?: number }) =>
    request<ApiRecipe>('/recipes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ApiRecipe>) =>
    request<ApiRecipe>(`/recipes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/recipes/${id}`, { method: 'DELETE' }),
};

// ── Batches ───────────────────────────────────────────────────────────────
export type ApiBatch = {
  batchesID: number;
  batchStatus: string | null;
  batchResult: string | null;
  operationMode: string | null;
  currentStep: number | null;
  recipeID: number | null;
  deviceID: number | null;
  recipe: { recipeID: number; recipeName: string | null } | null;
  device: { deviceID: number; deviceName: string | null } | null;
  batchOperations: { boID: number; startedAt: string | null; endedAt: string | null }[];
};

export const batchesApi = {
  getAll: () => request<ApiBatch[]>('/batches'),
  getOne: (id: number) => request<ApiBatch>(`/batches/${id}`),
  create: (data: { recipeID?: number; deviceID?: number; operationMode?: string }) =>
    request<ApiBatch>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { batchStatus?: string; batchResult?: string; currentStep?: number }) =>
    request<ApiBatch>(`/batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/batches/${id}`, { method: 'DELETE' }),
};

// ── Alerts ────────────────────────────────────────────────────────────────
export type ApiAlert = {
  alertID: number;
  alertType: string | null;
  alertMessage: string | null;
  alertTime: string | null;
  alertStatus: string | null;
  deviceID: number | null;
  device: { deviceID: number; deviceName: string | null } | null;
  alertResolutions: { arID: number; resolveStatus: string | null; resolveNote: string | null }[];
};

export const alertsApi = {
  getAll: (status?: string) =>
    request<ApiAlert[]>(`/alerts${status ? `?status=${status}` : ''}`),
  acknowledge: (id: number) =>
    request<ApiAlert>(`/alerts/${id}/acknowledge`, { method: 'PATCH' }),
  resolve: (id: number, data: { resolveStatus: string; resolveNote?: string }) =>
    request<unknown>(`/alerts/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── System Config ─────────────────────────────────────────────────────────
export const systemConfigApi = {
  getAll: () => request<Record<string, string>>('/system-config'),
  saveAll: (data: Record<string, string>) =>
    request<Record<string, string>>('/system-config', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ── Sensor Data ───────────────────────────────────────────────────────────
export type ApiSensorLog = {
  logID: number;
  measurements: unknown;
  logTimestamp: string | null;
  deviceID: number | null;
  device: { deviceID: number; deviceName: string | null } | null;
};

export const sensorDataApi = {
  getRecent: (deviceId?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (deviceId) params.set('deviceId', String(deviceId));
    if (limit) params.set('limit', String(limit));
    return request<ApiSensorLog[]>(`/sensor-data?${params}`);
  },
};

// ── MQTT Real-time ─────────────────────────────────────────────────────────
export type ApiMqttStateItem = {
  feed: string;
  topic: string;
  value: unknown;
  source: 'adafruit' | 'server-command' | 'server-simulate';
  updatedAt: string;
};

export type ApiMqttStatus = {
  enabled: boolean;
  connected: boolean;
  brokerUrl: string;
  username: string;
  subscribedFeeds: string[];
};

export const mqttApi = {
  getStatus: () => request<ApiMqttStatus>('/mqtt/status'),
  getState: () => request<ApiMqttStateItem[]>('/mqtt/state'),
  subscribeFeeds: (feeds: string[]) =>
    request<{ ok: boolean; feeds: string[]; note: string }>('/mqtt/subscribe', {
      method: 'POST',
      body: JSON.stringify({ feeds }),
    }),
  publishCommand: (feed: string, value: unknown, optimisticSync = true) =>
    request<{ ok: boolean; topic: string; payload: string }>('/mqtt/command', {
      method: 'POST',
      body: JSON.stringify({ feed, value, optimisticSync }),
    }),
  simulateIncoming: (feed: string, value: unknown) =>
    request<{
      ok: boolean;
      topic: string;
      feed: string;
      value: unknown;
      note?: string;
    }>('/mqtt/simulate/incoming', {
      method: 'POST',
      body: JSON.stringify({ feed, value }),
    }),
};
