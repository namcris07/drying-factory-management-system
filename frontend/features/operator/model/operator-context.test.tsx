import { render, screen, act, cleanup } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { batchesApi, chambersApi, mqttApi, recipesApi } = vi.hoisted(() => ({
  batchesApi: { getAll: vi.fn() },
  chambersApi: { getAll: vi.fn() },
  mqttApi: { getDeviceState: vi.fn() },
  recipesApi: { getAll: vi.fn() },
}));

vi.mock('@/shared/lib/api', () => ({
  batchesApi,
  chambersApi,
  mqttApi,
  recipesApi,
}));

import { OperatorProvider, useOperatorContext } from './operator-context';

function Probe() {
  const { machines, recipes, zone, operatorName } = useOperatorContext();

  const firstMachine = machines[0]
    ? {
        ...machines[0],
        recipe: machines[0].recipe ?? null,
        recipeId: machines[0].recipeId ?? null,
        progress: machines[0].progress ?? null,
        startTime: machines[0].startTime ?? null,
      }
    : null;

  return (
    <pre data-testid="probe">
      {JSON.stringify(
        {
          zone,
          operatorName,
          machines: firstMachine ? [firstMachine] : [],
          recipes,
        },
        null,
        2,
      )}
    </pre>
  );
}

describe('OperatorProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T01:00:00.000Z'));

    batchesApi.getAll.mockReset();
    chambersApi.getAll.mockReset();
    mqttApi.getDeviceState.mockReset();
    recipesApi.getAll.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('syncs machines, recipes, realtime state, and running batches', async () => {
    chambersApi.getAll.mockResolvedValue([
      {
        chamberID: 7,
        chamberName: 'May say 7',
        chamberDescription: 'Buong so 7',
        chamberStatus: 'Active',
        zoneID: 1,
        zoneName: 'Zone A',
        sensors: [
          {
            sensorName: 'Temp 7',
            sensorType: 'temperature',
            feedKey: 'm-a7/temperature',
            status: 'Active',
          },
          {
            sensorName: 'Hum 7',
            sensorType: 'humidity',
            feedKey: 'm-a7/humidity',
            status: 'Active',
          },
          {
            sensorName: 'Vibration 7',
            sensorType: 'custom',
            feedKey: 'm-a7/custom-vibration',
            status: 'Active',
          },
        ],
      },
    ]);

    recipesApi.getAll
      .mockResolvedValueOnce([
        {
          recipeID: 11,
          recipeName: 'Recipe 11',
          recipeFruits: 'Apple',
          timeDurationEst: 125,
          stages: [
            {
              stageOrder: 1,
              durationMinutes: 60,
              temperatureSetpoint: 65,
              humiditySetpoint: 45,
            },
            {
              stageOrder: 2,
              durationMinutes: 65,
              temperatureSetpoint: 60,
              humiditySetpoint: 42,
            },
          ],
          steps: [
            {
              stepID: 1,
              stepNo: 1,
              temperatureGoal: 65,
              humidityGoal: 45,
              durationMinutes: 60,
              fanStatus: 'On',
            },
          ],
        },
      ])
      .mockResolvedValueOnce([
        {
          recipeID: 11,
          recipeName: 'Recipe 11',
          recipeFruits: 'Apple',
          timeDurationEst: 125,
          stages: [
            {
              stageOrder: 1,
              durationMinutes: 60,
              temperatureSetpoint: 65,
              humiditySetpoint: 45,
            },
            {
              stageOrder: 2,
              durationMinutes: 65,
              temperatureSetpoint: 60,
              humiditySetpoint: 42,
            },
          ],
          steps: [],
        },
        {
          recipeID: 12,
          recipeName: 'Recipe 12',
          recipeFruits: 'Banana',
          timeDurationEst: 90,
          stages: [],
          steps: [],
        },
      ]);

    mqttApi.getDeviceState.mockResolvedValue({
      deviceId: 7,
      feeds: [
        {
          feed: 'm-a7/temperature',
          sensorType: 'temperature',
          topic: 'user/feeds/m-a7/temperature',
          value: 65.2,
          source: 'adafruit',
          updatedAt: '2026-01-01T00:55:00.000Z',
        },
        {
          feed: 'm-a7/humidity',
          sensorType: 'humidity',
          topic: 'user/feeds/m-a7/humidity',
          value: 40.1,
          source: 'adafruit',
          updatedAt: '2026-01-01T00:55:00.000Z',
        },
        {
          feed: 'm-a7/custom-vibration',
          sensorType: 'custom',
          topic: null,
          value: 1,
          source: 'adafruit',
          updatedAt: '2026-01-01T00:55:00.000Z',
        },
      ],
    });

    batchesApi.getAll
      .mockResolvedValueOnce({
        items: [
          {
            batchesID: 91,
            batchStatus: 'Running',
            batchResult: null,
            operationMode: 'auto',
            currentStage: 2,
            currentStep: 2,
            startedAt: '2026-01-01T00:30:00.000Z',
            stageStartedAt: '2026-01-01T00:40:00.000Z',
            recipeID: 11,
            deviceID: 7,
            recipe: {
              recipeID: 11,
              recipeName: 'Recipe 11',
              timeDurationEst: 125,
              stages: [
                { stageOrder: 1, durationMinutes: 60, temperatureSetpoint: 65, humiditySetpoint: 45 },
                { stageOrder: 2, durationMinutes: 65, temperatureSetpoint: 60, humiditySetpoint: 42 },
              ],
              steps: [],
            },
            device: { deviceID: 7, deviceName: 'May say 7' },
            batchOperations: [],
          },
        ],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 1,
          totalPages: 1,
        },
      })
      .mockResolvedValue({
        items: [],
        pagination: {
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
        },
      });

    render(
      <OperatorProvider zone="Zone A" operatorName="Operator X">
        <Probe />
      </OperatorProvider>,
    );

    await flush();

    let probe = screen.getByTestId('probe').textContent ?? '';
    expect(probe).toContain('"status": "Idle"');
    expect(probe).toContain('"recipeId": null');
    expect(probe).toContain('"progress": null');
    expect(probe).toContain('"duration": 125');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await flush();

    probe = screen.getByTestId('probe').textContent ?? '';
    expect(probe).toContain('"status": "Running"');
    expect(probe).toContain('"recipeId": 11');
    expect(probe).toContain('"progress": 24');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await flush();

    probe = screen.getByTestId('probe').textContent ?? '';
    expect(probe).toContain('"temp": 65.2');
    expect(probe).toContain('"humidity": 40.1');
    expect(probe).toContain('"sensorFeeds": [');
    expect(probe).toContain('"m-a7/custom-vibration"');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await flush();

    probe = screen.getByTestId('probe').textContent ?? '';
    expect(probe).toContain('"recipes": [');
    expect(probe).toContain('"id": 12');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await flush();

    probe = screen.getByTestId('probe').textContent ?? '';
    expect(probe).toContain('"status": "Idle"');
    expect(probe).toContain('"recipe": null');
  });
});