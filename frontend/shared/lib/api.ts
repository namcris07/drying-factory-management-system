/**
 * shared/lib/api.ts
 * Centralized API client for NestJS backend.
 * All HTTP requests go through this module.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

export class ApiError extends Error {
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
    request<{
      id: number;
      name: string;
      role: string;
      zone: string;
      zones?: { zoneID: number; zoneName: string }[];
      email: string;
    }>(
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
    chamberIDs?: number[];
  }) => request<ApiUser>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: number,
    data: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      status: string;
      password: string;
      chamberIDs: number[];
    }>,
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

export type ApiChamber = {
  chamberID: number;
  chamberName: string | null;
  chamberDescription: string | null;
  chamberStatus: string | null;
  zoneID: number | null;
  zoneName: string | null;
  sensors: {
    sensorName: string;
    sensorType: string;
    feedKey: string;
    status: string;
  }[];
};

export const chambersApi = {
  getAll: () => request<ApiChamber[]>('/chambers'),
  getOne: (id: number) => request<ApiChamber>(`/chambers/${id}`),
  create: (data: {
    chamberName: string;
    chamberDescription?: string;
    zoneID: number;
    chamberStatus?: string;
    sensors?: {
      sensorName?: string;
      sensorType: string;
      feedKey: string;
      status?: string;
    }[];
  }) =>
    request<ApiChamber>('/chambers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{
    chamberName: string;
    chamberDescription: string;
    zoneID: number;
    chamberStatus: string;
    sensors: {
      sensorName?: string;
      sensorType: string;
      feedKey: string;
      status?: string;
    }[];
  }>) =>
    request<ApiChamber>(`/chambers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => request<{ ok: boolean }>(`/chambers/${id}`, { method: 'DELETE' }),
};

// ── Devices ───────────────────────────────────────────────────────────────
export type ApiDevice = {
  deviceID: number;
  deviceName: string | null;
  deviceStatus: string | null;
  deviceType: string | null;
  mqttTopicSensor: string | null;
  sensorFeeds?: string[];
  zoneID: number | null;
  zone: { zoneID: number; zoneName: string | null } | null;
  metaData: Record<string, unknown> | null;
};

export type DeviceUpsertPayload = {
  deviceName: string;
  deviceStatus?: string;
  deviceType?: string;
  mqttTopicSensor?: string;
  zoneID?: number;
  metaData?: Record<string, unknown>;
};

export type DevicePatchPayload = Partial<DeviceUpsertPayload>;

export const devicesApi = {
  getAll: () => request<ApiDevice[]>('/devices'),
  create: (data: DeviceUpsertPayload) =>
    request<ApiDevice>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: DevicePatchPayload) =>
    request<ApiDevice>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  validateFeeds: (data: {
    mqttTopicSensor?: string;
    currentDeviceId?: number;
  }) => request<{ ok: boolean }>('/devices/validate-feeds', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
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

export type ApiRecipeStage = {
  stageID: number;
  stageOrder: number;
  durationMinutes: number;
  temperatureSetpoint: number;
  humiditySetpoint: number;
};

export type RecipeStepPayload = {
  stepNo?: number;
  temperatureGoal?: number;
  humidityGoal?: number;
  durationMinutes?: number;
  fanStatus?: string;
};

export type RecipeStagePayload = {
  stageOrder: number;
  durationMinutes: number;
  temperatureSetpoint: number;
  humiditySetpoint: number;
};

export type ApiRecipe = {
  recipeID: number;
  recipeName: string | null;
  recipeFruits: string | null;
  timeDurationEst: number | null;
  userID: number | null;
  isActive: boolean;
  batchCount: number;
  steps: ApiRecipeStep[];
  stages: ApiRecipeStage[];
};

export type RecipeRemoveResult =
  | { action: 'hidden'; recipe: ApiRecipe }
  | { action: 'deleted'; recipeID: number };

export const recipesApi = {
  getAll: (params?: { includeInactive?: boolean }) =>
    request<ApiRecipe[]>(
      `/recipes${params?.includeInactive ? '?includeInactive=true' : ''}`,
    ),
  getOne: (id: number) => request<ApiRecipe>(`/recipes/${id}`),
  create: (data: {
    recipeName: string;
    recipeFruits?: string;
    timeDurationEst?: number;
    userID?: number;
    isActive?: boolean;
    steps?: RecipeStepPayload[];
    stages?: RecipeStagePayload[];
  }) =>
    request<ApiRecipe>('/recipes', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: number,
    data: Partial<{
      recipeName: string;
      recipeFruits: string;
      timeDurationEst: number;
      userID: number;
      isActive: boolean;
      steps: RecipeStepPayload[];
      stages: RecipeStagePayload[];
    }>,
  ) =>
    request<ApiRecipe>(`/recipes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) =>
    request<RecipeRemoveResult>(`/recipes/${id}`, { method: 'DELETE' }),
};

// ── Batches ───────────────────────────────────────────────────────────────
export type ApiBatch = {
  batchesID: number;
  batchStatus: string | null;
  batchResult: string | null;
  operationMode: string | null;
  currentStage: number | null;
  currentStep: number | null;
  startedAt: string | null;
  stageStartedAt: string | null;
  recipeID: number | null;
  deviceID: number | null;
  recipe:
    | {
        recipeID: number;
        recipeName: string | null;
        timeDurationEst?: number | null;
        stages?: ApiRecipeStage[];
        steps?: ApiRecipeStep[];
      }
    | null;
  device: { deviceID: number; deviceName: string | null } | null;
  batchOperations: { boID: number; startedAt: string | null; endedAt: string | null }[];
};

export type ApiPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiBatchList = {
  items: ApiBatch[];
  pagination: ApiPagination;
};

export const batchesApi = {
  getAll: (query?: {
    status?: 'all' | 'running' | 'completed' | 'fail';
    page?: number;
    pageSize?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.page) params.set('page', String(query.page));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));
    const q = params.toString();
    return request<ApiBatchList>(`/batches${q ? `?${q}` : ''}`);
  },
  getOne: (id: number) => request<ApiBatch>(`/batches/${id}`),
  create: (data: { recipeID: number; deviceID?: number; chamberID?: number; operationMode?: string; startTime: string }) =>
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
  alertResolutions: {
    arID: number;
    resolveTime: string | null;
    resolveStatus: string | null;
    resolveNote: string | null;
    userID: number | null;
    user: {
      userID: number;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    } | null;
  }[];
};

export const alertsApi = {
  getAll: (status?: string) =>
    request<ApiAlert[]>(`/alerts${status ? `?status=${status}` : ''}`),
  acknowledge: (id: number) =>
    request<ApiAlert>(`/alerts/${id}/acknowledge`, { method: 'PATCH' }),
  resolve: (id: number, data: { resolveStatus: string; resolveNote?: string; userID?: number }) =>
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

export type ApiMqttDeviceFeedState = {
  feed: string;
  sensorType: string;
  topic: string | null;
  value: unknown;
  source: 'adafruit' | 'server-command' | 'server-simulate' | null;
  updatedAt: string | null;
};

export type ApiMqttDeviceState = {
  deviceId: number;
  feeds: ApiMqttDeviceFeedState[];
};

export const mqttApi = {
  getStatus: () => request<ApiMqttStatus>('/mqtt/status'),
  getState: () => request<ApiMqttStateItem[]>('/mqtt/state'),
  getDeviceState: (deviceId: number) =>
    request<ApiMqttDeviceState>(`/mqtt/device/${deviceId}/state`),
  subscribeFeeds: (feeds: string[]) =>
    request<{ ok: boolean; feeds: string[]; note: string }>('/mqtt/subscribe', {
      method: 'POST',
      body: JSON.stringify({ feeds }),
    }),
  publishCommand: (feed: string, value: unknown, optimisticSync = true) =>
    request<{ ok: boolean; topic: string; payload: string; note?: string }>(
      '/mqtt/command',
      {
      method: 'POST',
      body: JSON.stringify({ feed, value, optimisticSync }),
      },
    ),
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

  // ── Analytics ─────────────────────────────────────────────────────────────
  export type ApiAnalyticsSummary = {
    range: { from: string | null; to: string | null };
    batches: {
      total: number;
      success: number;
      fail: number;
      running: number;
      successRate: number;
      failRate: number;
    };
    machines: {
      total: number;
      active: number;
      inactive: number;
    };
  };

  export type ApiAnalyticsTrendPoint = {
    date: string;
    total: number;
    success: number;
    fail: number;
    running: number;
    successRate: number;
  };

  export type ApiAnalyticsTrend = {
    range: { from: string | null; to: string | null };
    period?: 'day' | 'week' | 'month' | 'year';
    status?: 'all' | 'success' | 'fail';
    points: ApiAnalyticsTrendPoint[];
    pagination?: ApiPagination;
  };

  export type ApiAnalyticsHourlyPoint = {
    hour: string;
    avg: number;
    samples: number;
  };

  export type ApiAnalyticsHourly = {
    metric: 'temperature' | 'humidity' | string;
    range: { from: string | null; to: string | null };
    points: ApiAnalyticsHourlyPoint[];
  };

  type AnalyticsQuery = {
    from?: string;
    to?: string;
    zoneId?: number;
  };

  const buildAnalyticsQuery = (query?: AnalyticsQuery) => {
    const params = new URLSearchParams();
    if (query?.from) params.set('from', query.from);
    if (query?.to) params.set('to', query.to);
    if (query?.zoneId) params.set('zoneId', String(query.zoneId));
    return params.toString();
  };

  export const analyticsApi = {
    getSummary: (query?: AnalyticsQuery) => {
      const params = buildAnalyticsQuery(query);
      return request<ApiAnalyticsSummary>(
        `/analytics/summary${params ? `?${params}` : ''}`,
      );
    },
    getTrend: (
      query?:
        | (AnalyticsQuery & {
            period?: 'day' | 'week' | 'month' | 'year';
            status?: 'all' | 'success' | 'fail';
            page?: number;
            pageSize?: number;
          })
        | undefined,
    ) => {
      const params = new URLSearchParams(buildAnalyticsQuery(query));
      if (query?.period) params.set('period', query.period);
      if (query?.status) params.set('status', query.status);
      if (query?.page) params.set('page', String(query.page));
      if (query?.pageSize) params.set('pageSize', String(query.pageSize));
      const q = params.toString();
      return request<ApiAnalyticsTrend>(
        `/analytics/trend${q ? `?${q}` : ''}`,
      );
    },
    getHourlyAvg: (
      query?: AnalyticsQuery & { metric?: 'temperature' | 'humidity' },
    ) => {
      const params = new URLSearchParams(buildAnalyticsQuery(query));
      if (query?.metric) params.set('metric', query.metric);
      const q = params.toString();
      return request<ApiAnalyticsHourly>(
        `/analytics/hourly-avg${q ? `?${q}` : ''}`,
      );
    },
  };
