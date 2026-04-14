"use client";

/**
 * contexts/OperatorContext.tsx
 * Context để chia sẻ state giữa OperatorLayout và các operator pages
 */
import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Machine, Recipe } from '@/features/operator/model/machine-data';
import { devicesApi, mqttApi, recipesApi } from '@/shared/lib/api';

export type OperatorContextType = {
  machines:     Machine[];
  setMachines:  React.Dispatch<React.SetStateAction<Machine[]>>;
  zone:         string;
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
  operatorName: string;
}

export function OperatorProvider({ children, zone, operatorName }: OperatorProviderProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const machinesRef = useRef<Machine[]>([]);

  useEffect(() => {
    machinesRef.current = machines;
  }, [machines]);

  useEffect(() => {
    let mounted = true;

    const toMachineId = (name: string | null, topic: string | null, id: number) => {
      const topicMatch = topic?.match(/\/(m-[a-z0-9]+)\//i)?.[1]?.toUpperCase();
      if (topicMatch) return topicMatch;

      const nameMatch = name?.match(/([A-Z]\d+)/i)?.[1]?.toUpperCase();
      if (nameMatch) return `M-${nameMatch}`;

      return `M-A${id}`;
    };

    const parseSensorFeeds = (raw: unknown): string[] => {
      if (Array.isArray(raw)) {
        return Array.from(
          new Set(
            raw
              .map((item) => String(item ?? '').trim())
              .filter(Boolean),
          ),
        );
      }

      if (typeof raw === 'string') {
        return Array.from(
          new Set(
            raw
              .split(/[\n,;]/)
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        );
      }

      return [];
    };

    const loadBaseData = async () => {
      try {
        const [deviceRows, recipeRows] = await Promise.all([
          devicesApi.getAll(),
          recipesApi.getAll(),
        ]);

        if (!mounted) return;

        const mappedMachines: Machine[] = deviceRows.map((row) => ({
          id: toMachineId(row.deviceName, row.mqttTopicSensor, row.deviceID),
          deviceID: row.deviceID,
          name: row.deviceName || `May say ${row.deviceID}`,
          zone: row.zone?.zoneName || zone,
          status: row.deviceStatus === 'Active' ? 'Idle' : 'Maintenance',
          temp: 0,
          humidity: 0,
          sensorFeeds: parseSensorFeeds(row.sensorFeeds ?? row.mqttTopicSensor),
          sensorState: [],
        }));

        const mappedRecipes: Recipe[] = recipeRows.map((row) => {
          const firstStage = row.stages?.[0];
          const firstStep = row.steps?.[0];

          return {
            id: row.recipeID,
            name: row.recipeName || `Cong thuc ${row.recipeID}`,
            fruit: row.recipeFruits || '-',
            temp: Number(
              firstStage?.temperatureSetpoint ?? firstStep?.temperatureGoal ?? 0,
            ),
            humidity: Number(
              firstStage?.humiditySetpoint ?? firstStep?.humidityGoal ?? 0,
            ),
            duration: Math.max(1, Math.round((row.timeDurationEst ?? 60) / 60)),
          };
        });

        setMachines(mappedMachines);
        setRecipes(mappedRecipes);
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
  }, [zone]);

  // Đồng bộ realtime từ backend MQTT state mỗi 3 giây
  useEffect(() => {
    let mounted = true;

    const parseNumber = (value: unknown) => {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(num * 10) / 10 : undefined;
    };

    const syncFromServer = async () => {
      try {
        const machineRows = machinesRef.current.filter((item) =>
          Number.isFinite(item.deviceID),
        );
        if (machineRows.length === 0) return;

        const stateRows = await Promise.all(
          machineRows.map(async (machine) => {
            try {
              const state = await mqttApi.getDeviceState(machine.deviceID as number);
              return [machine.deviceID as number, state] as const;
            } catch {
              return [machine.deviceID as number, null] as const;
            }
          }),
        );

        if (!mounted) return;

        const byDevice = new Map(stateRows);

        setMachines((prev) =>
          prev.map((machine) => {
            if (!machine.deviceID) return machine;

            const deviceState = byDevice.get(machine.deviceID);
            if (!deviceState) return machine;

            const tempFeed = deviceState.feeds.find(
              (feed) => feed.sensorType === 'temperature',
            );
            const humidityFeed = deviceState.feeds.find(
              (feed) => feed.sensorType === 'humidity',
            );

            const temp = parseNumber(tempFeed?.value);
            const humidity = parseNumber(humidityFeed?.value);

            return {
              ...machine,
              temp: temp ?? machine.temp,
              humidity: humidity ?? machine.humidity,
              sensorState: deviceState.feeds.map((feed) => ({
                feed: feed.feed,
                sensorType: feed.sensorType,
                value: feed.value,
                updatedAt: feed.updatedAt,
              })),
              sensorFeeds:
                deviceState.feeds.length > 0
                  ? deviceState.feeds.map((feed) => feed.feed)
                  : machine.sensorFeeds,
            };
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
    zone,
    operatorName,
    recipes,
  };

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  );
}
