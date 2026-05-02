"use client";

/**
 * contexts/OperatorContext.tsx
 * Context để chia sẻ state giữa OperatorLayout và các operator pages
 */
import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useMemo } from 'react';
import { Machine, Recipe, SensorState, ActuatorState } from '@/features/operator/model/machine-data';
import { batchesApi, chambersApi, mqttApi, recipesApi } from '@/shared/lib/api';

export type OperatorContextType = {
  machines:     Machine[];
  setMachines:  React.Dispatch<React.SetStateAction<Machine[]>>;
  zones:        string[];
  zone:         string;
  setZone:      (zone: string) => void;
  operatorName: string;
  recipes:      Recipe[];
};

const OperatorContext = createContext<OperatorContextType | null>(null);

export function useOperatorContext() {
  const context = useContext(OperatorContext);
  if (!context) {
    throw new Error('useOperatorContext must be used within OperatorProvider');
  }
  return context;
}

interface OperatorProviderProps {
  children: ReactNode;
  zone: string;
  zones?: string[];
  operatorName: string;
}

export function OperatorProvider({
  children,
  zone: initialZone,
  zones: assignedZones,
  operatorName,
}: OperatorProviderProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const machinesRef = useRef<Machine[]>([]);

  const zones = useMemo(() => {
    const rows = [
      ...(Array.isArray(assignedZones) ? assignedZones : []),
      initialZone,
    ]
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);

    return Array.from(new Set(rows));
  }, [assignedZones, initialZone]);

  const [zoneState, setZoneState] = useState<string>(zones[0] ?? 'Zone A');
  const zone = zones.includes(zoneState) ? zoneState : (zones[0] ?? 'Zone A');
  const setZone = (nextZone: string) => {
    setZoneState(nextZone);
  };

  const mapRecipes = (recipeRows: Awaited<ReturnType<typeof recipesApi.getAll>>): Recipe[] => {
    return recipeRows.map((row) => {
      const firstStage = row.stages?.[0];
      const firstStep = row.steps?.[0];
      const totalStageMinutes = Array.isArray(row.stages)
        ? row.stages.reduce((sum, stage) => {
            const stageMinutes = Number(stage.durationMinutes ?? 0);
            return Number.isFinite(stageMinutes) ? sum + stageMinutes : sum;
          }, 0)
        : 0;
      const durationMinutes =
        totalStageMinutes > 0
          ? totalStageMinutes
          : Number(row.timeDurationEst ?? 60);

      return {
        id: row.recipeID,
        name: row.recipeName || `Công thức ${row.recipeID}`,
        fruit: row.recipeFruits || '-',
        temp: Number(
          firstStage?.temperatureSetpoint ?? firstStep?.temperatureGoal ?? 0,
        ),
        humidity: Number(
          firstStage?.humiditySetpoint ?? firstStep?.humidityGoal ?? 0,
        ),
        duration: Math.max(1, Math.round(durationMinutes)),
      };
    });
  };

  useEffect(() => {
    machinesRef.current = machines;
  }, [machines]);

  useEffect(() => {
    let mounted = true;

    const toMachineId = (name: string | null, id: number) => {
      const nameMatch = name?.match(/([A-Z]\d+)/i)?.[1]?.toUpperCase();
      if (nameMatch) return `M-${nameMatch}`;
      return `M-C${id}`;
    };

    const normalizeFeed = (raw: unknown): string | null => {
      const value = String(raw ?? '').trim().toLowerCase();
      if (!value) return null;
      const marker = '/feeds/';
      const index = value.indexOf(marker);
      return index >= 0 ? value.slice(index + marker.length).trim() : value;
    };

    const mapDeviceStatusToOperator = (
      rawStatus: string | null | undefined,
    ): Machine['status'] => {
      const status = String(rawStatus ?? '').trim().toLowerCase();
      if (status === 'maintenance') return 'Maintenance';
      if (status === 'error' || status === 'fault' || status === 'offline') {
        return 'Error';
      }
      if (status === 'inactive') return 'Idle';
      return 'Idle';
    };

    const loadBaseData = async () => {
      try {
        const [chamberRows, recipeRows] = await Promise.all([
          chambersApi.getAll(),
          recipesApi.getAll(),
        ]);

        if (!mounted) return;

        const allowedZones = new Set(zones.map((item) => item.toLowerCase()));

        const mappedMachines: Machine[] = chamberRows
          .filter((row) => {
            if (allowedZones.size === 0) return true;
            const rowZone = String(row.zoneName ?? '').toLowerCase();
            return allowedZones.has(rowZone);
          })
          .map((row) => {
            const sensorFeeds = Array.from(
              new Set(
                (row.sensors ?? [])
                  .map((sensor) => normalizeFeed(sensor.feedKey))
                  .filter((feed): feed is string => Boolean(feed)),
              ),
            );

            const sensorState = (row.sensors ?? []).map((sensor) => {
              const fallbackSensorName =
                sensor.sensorName?.trim() ||
                sensor.sensorType?.trim() ||
                normalizeFeed(sensor.feedKey) ||
                sensor.feedKey;

              return {
                feed: normalizeFeed(sensor.feedKey) ?? sensor.feedKey,
                sensorName: fallbackSensorName,
                sensorType: sensor.sensorType?.trim() || 'Custom',
                value: null,
                updatedAt: null,
              };
            });

            const actuatorState = (row.actuatorChannels ?? []).map((actuator) => {
              const fallbackActuatorName =
                actuator.actuatorName?.trim() ||
                actuator.actuatorType?.trim() ||
                normalizeFeed(actuator.feedKey) ||
                actuator.feedKey;

              return {
                feed: normalizeFeed(actuator.feedKey) ?? actuator.feedKey,
                actuatorName: fallbackActuatorName,
                actuatorType: actuator.actuatorType?.trim() || 'Custom',
                value: null,
                updatedAt: null,
              };
            });

            return {
              id: toMachineId(row.chamberName, row.chamberID),
              deviceID: row.chamberID,
              name: row.chamberName || `Buồng sấy ${row.chamberID}`,
              zone: row.zoneName || 'Chưa phân khu',
              zoneID: row.zoneID ?? undefined,
              deviceType: 'DryingChamber',
              deviceStatusRaw: row.chamberStatus ?? undefined,
              status: mapDeviceStatusToOperator(row.chamberStatus),
              temp: 0,
              humidity: 0,
              sensorFeeds,
              sensorState,
              actuatorState,
            } as Machine;
          });

        setMachines(mappedMachines);
        setRecipes(mapRecipes(recipeRows));
      } catch {
        if (!mounted) return;
        setMachines([]);
        setRecipes([]);
      }
    };

    void loadBaseData();

    return () => {
      mounted = false;
    };
  }, [zone, zones]);

  // Đồng bộ danh sách công thức để Operator thấy recipe mới mà không cần reload trang.
  useEffect(() => {
    let mounted = true;

    const syncRecipes = async () => {
      try {
        const recipeRows = await recipesApi.getAll();
        if (!mounted) return;
        setRecipes(mapRecipes(recipeRows));
      } catch {
        // Giữ danh sách công thức hiện tại nếu API tạm gián đoạn.
      }
    };

    const interval = setInterval(() => {
      void syncRecipes();
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Đồng bộ realtime từ backend MQTT state mỗi 3 giây
  useEffect(() => {
    let mounted = true;

    const parseNumber = (value: unknown) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num * 10) / 10 : undefined;
    };

    const toHourMinute = (isoTime: string | null | undefined) => {
      if (!isoTime) return undefined;
      const date = new Date(isoTime);
      if (Number.isNaN(date.getTime())) return undefined;
      return `${date.getHours().toString().padStart(2, '0')}:${date
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
    };

    const resolveProgressPercent = (batch: {
      startedAt: string | null;
      recipe:
        | {
            timeDurationEst?: number | null;
            stages?: { durationMinutes: number }[];
          }
        | null;
    }) => {
      const start = batch.startedAt ? new Date(batch.startedAt) : null;
      if (!start || Number.isNaN(start.getTime())) return undefined;

      const stageMinutes = Array.isArray(batch.recipe?.stages)
        ? batch.recipe!.stages!.reduce((sum, stage) => {
            const minutes = Number(stage.durationMinutes ?? 0);
            return Number.isFinite(minutes) ? sum + minutes : sum;
          }, 0)
        : 0;
      const totalMinutes =
        stageMinutes > 0
          ? stageMinutes
          : Number(batch.recipe?.timeDurationEst ?? 0);

      if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return undefined;

      const elapsedMinutes =
        (Date.now() - start.getTime()) / (1000 * 60);
      const percent = Math.round((elapsedMinutes / totalMinutes) * 100);
      return Math.max(0, Math.min(100, percent));
    };

    const syncFromServer = async () => {
      try {
        const machineRows = machinesRef.current.filter((item) =>
          Number.isFinite(item.deviceID),
        );
        if (machineRows.length === 0) return;

        const [stateRows, runningBatches] = await Promise.all([
          Promise.all(
            machineRows.map(async (machine) => {
              try {
                const state = await mqttApi.getDeviceState(machine.deviceID as number);
                return [machine.deviceID as number, state] as const;
              } catch {
                return [machine.deviceID as number, null] as const;
              }
            }),
          ),
          batchesApi
            .getAll({ status: 'running', page: 1, pageSize: 100 })
            .then((res) => res.items)
            .catch(() => []),
        ]);

        if (!mounted) return;

        const byDevice = new Map(stateRows);
        const runningBatchByDevice = new Map(
          runningBatches
            .filter((batch) => Number.isFinite(batch.deviceID))
            .map((batch) => [batch.deviceID as number, batch] as const),
        );

        setMachines((prev) =>
          prev.map((machine) => {
            if (!machine.deviceID) return machine;

            const deviceState = byDevice.get(machine.deviceID);
            const runningBatch = runningBatchByDevice.get(machine.deviceID);

            if (!deviceState && !runningBatch) return machine;

            const feeds = deviceState?.feeds ?? [];

            // Tính temp/humidity tổng hợp bất kể nhiều sensor
            const tempFeeds = feeds.filter(
              (f) => f.sensorType === 'temperature' || String(f.sensorType).toLowerCase().includes('temp'),
            );
            const humidityFeeds = feeds.filter(
              (f) => f.sensorType === 'humidity' || String(f.sensorType).toLowerCase().includes('humid'),
            );

            const avgOrFirst = (arr: typeof feeds) => {
              const nums = arr
                .map((f) => parseNumber(f.value))
                .filter((n): n is number => n !== undefined);
              if (nums.length === 0) return undefined;
              return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
            };

            const temp = avgOrFirst(tempFeeds);
            const humidity = avgOrFirst(humidityFeeds);

            // Phân loại feeds thành sensor và actuator
            // Actuator: loại thiết bị chấp hành (Fan, Led, Lcd, Pump, Heater, ...)
            // Sensor: nguồn dữ liệu đọc (TemperatureSensor, HumiditySensor, LightSensor, Custom...)
            const ACTUATOR_TYPES = new Set([
              'fan', 'led', 'lcd', 'pump', 'heater', 'humidifier', 'doorlock',
              'Fan', 'Led', 'Lcd', 'Pump', 'Heater', 'Humidifier', 'DoorLock',
            ]);
            const isActuatorType = (type: string) =>
              ACTUATOR_TYPES.has(type) ||
              String(type).toLowerCase().includes('fan') ||
              String(type).toLowerCase().includes('led') ||
              String(type).toLowerCase().includes('lcd') ||
              String(type).toLowerCase().includes('pump') ||
              String(type).toLowerCase().includes('heater');

            const sensorFeeds = feeds.filter((f) => !isActuatorType(f.sensorType));
            const actuatorFeeds = feeds.filter((f) => isActuatorType(f.sensorType));

            const sensorState: SensorState[] = sensorFeeds.map((f) => ({
              feed: f.feed,
              sensorName: f.sensorType,
              sensorType: f.sensorType,
              value: f.value,
              updatedAt: f.updatedAt,
            }));

            const actuatorState: ActuatorState[] = actuatorFeeds.map((f) => ({
              feed: f.feed,
              actuatorName: f.sensorType,
              actuatorType: f.sensorType,
              value: f.value,
              updatedAt: f.updatedAt,
            }));

            const baseMachine = {
              ...machine,
              temp: temp ?? machine.temp,
              humidity: humidity ?? machine.humidity,
              sensorState,
              actuatorState,
              sensorFeeds:
                sensorFeeds.length > 0
                  ? sensorFeeds.map((f) => f.feed)
                  : machine.sensorFeeds,
            };

            if (runningBatch) {
              return {
                ...baseMachine,
                status: 'Running' as const,
                recipe: runningBatch.recipe?.recipeName ?? machine.recipe,
                recipeId: runningBatch.recipe?.recipeID ?? machine.recipeId,
                startTime: toHourMinute(runningBatch.startedAt) ?? machine.startTime,
                progress: resolveProgressPercent(runningBatch),
              };
            }

            if (machine.status === 'Running') {
              return {
                ...baseMachine,
                status: 'Idle' as const,
                recipe: undefined,
                recipeId: undefined,
                startTime: undefined,
                progress: undefined,
              };
            }

            return baseMachine;
          }),
        );
      } catch {
        // Giữ state cũ nếu backend/MQTT tạm thời gián đoạn
      }
    };

    void syncFromServer();

    const interval = setInterval(() => {
      void syncFromServer();
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const value: OperatorContextType = {
    machines,
    setMachines,
    zones,
    zone,
    setZone,
    operatorName,
    recipes,
  };

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  );
}
