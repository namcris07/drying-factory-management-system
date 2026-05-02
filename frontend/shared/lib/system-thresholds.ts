export type SystemThresholds = {
  maxTempSafe: number;
  minHumidity: number;
  maxHumidity: number;
  tempHysteresisDelta: number;
  humidityHysteresisDelta: number;
  autoStopEnabled: boolean;
  alertDelaySeconds: number;
  mqttBrokerHost: string;
  mqttBrokerPort: number;
  mqttKeepAlive: number;
  dataRetentionDays: number;
  batchAutoArchiveDays: number;
  lightSensorThreshold: number;
  doorOpenTimeout: number;
};

export const DEFAULT_SYSTEM_THRESHOLDS: SystemThresholds = {
  maxTempSafe: 90,
  minHumidity: 8,
  maxHumidity: 85,
  tempHysteresisDelta: 5,
  humidityHysteresisDelta: 5,
  autoStopEnabled: true,
  alertDelaySeconds: 15,
  mqttBrokerHost: 'mqtt.drytech.internal',
  mqttBrokerPort: 1883,
  mqttKeepAlive: 60,
  dataRetentionDays: 365,
  batchAutoArchiveDays: 90,
  lightSensorThreshold: 90,
  doorOpenTimeout: 5,
};

export function systemThresholdsFromRecord(
  rec: Record<string, string>,
): SystemThresholds {
  return {
    maxTempSafe: Number(rec.maxTempSafe ?? DEFAULT_SYSTEM_THRESHOLDS.maxTempSafe),
    minHumidity: Number(rec.minHumidity ?? DEFAULT_SYSTEM_THRESHOLDS.minHumidity),
    maxHumidity: Number(rec.maxHumidity ?? DEFAULT_SYSTEM_THRESHOLDS.maxHumidity),
    tempHysteresisDelta: Number(
      rec.tempHysteresisDelta ?? DEFAULT_SYSTEM_THRESHOLDS.tempHysteresisDelta,
    ),
    humidityHysteresisDelta: Number(
      rec.humidityHysteresisDelta ??
        DEFAULT_SYSTEM_THRESHOLDS.humidityHysteresisDelta,
    ),
    autoStopEnabled:
      (rec.autoStopEnabled ?? String(DEFAULT_SYSTEM_THRESHOLDS.autoStopEnabled)) ===
      'true',
    alertDelaySeconds: Number(
      rec.alertDelaySeconds ?? DEFAULT_SYSTEM_THRESHOLDS.alertDelaySeconds,
    ),
    mqttBrokerHost: rec.mqttBrokerHost ?? DEFAULT_SYSTEM_THRESHOLDS.mqttBrokerHost,
    mqttBrokerPort: Number(rec.mqttBrokerPort ?? DEFAULT_SYSTEM_THRESHOLDS.mqttBrokerPort),
    mqttKeepAlive: Number(rec.mqttKeepAlive ?? DEFAULT_SYSTEM_THRESHOLDS.mqttKeepAlive),
    dataRetentionDays: Number(
      rec.dataRetentionDays ?? DEFAULT_SYSTEM_THRESHOLDS.dataRetentionDays,
    ),
    batchAutoArchiveDays: Number(
      rec.batchAutoArchiveDays ?? DEFAULT_SYSTEM_THRESHOLDS.batchAutoArchiveDays,
    ),
    lightSensorThreshold: Number(
      rec.lightSensorThreshold ?? DEFAULT_SYSTEM_THRESHOLDS.lightSensorThreshold,
    ),
    doorOpenTimeout: Number(
      rec.doorOpenTimeout ?? DEFAULT_SYSTEM_THRESHOLDS.doorOpenTimeout,
    ),
  };
}

export function systemThresholdsToRecord(
  thresholds: SystemThresholds,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(thresholds).map(([key, value]) => [key, String(value)]),
  );
}
