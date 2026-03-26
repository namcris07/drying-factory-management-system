export type FormulaThresholdConfig = {
  maxTemperature: number | null;
  maxHumidity: number | null;
  recipeName: string | null;
  fruitType: string | null;
  source: 'recipe-step' | 'fruit-default' | 'none';
};

const FRUIT_TEMPERATURE_DEFAULTS: Array<{
  aliases: string[];
  maxTemperature: number;
}> = [
  { aliases: ['xoai', 'mango'], maxTemperature: 60 },
  { aliases: ['mit', 'jackfruit'], maxTemperature: 62 },
];

const FRUIT_HUMIDITY_DEFAULTS: Array<{
  aliases: string[];
  maxHumidity: number;
}> = [
  { aliases: ['xoai', 'mango'], maxHumidity: 40 },
  { aliases: ['mit', 'jackfruit'], maxHumidity: 50 },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function resolveFormulaThreshold(params: {
  recipeName?: string | null;
  recipeFruits?: string | null;
  stepTemperatureGoal?: number | null;
  stepHumidityGoal?: number | null;
}): FormulaThresholdConfig {
  const stepTemperatureGoal = Number(params.stepTemperatureGoal);
  const stepHumidityGoal = Number(params.stepHumidityGoal);

  const hasStepTemp =
    Number.isFinite(stepTemperatureGoal) && stepTemperatureGoal > 0;
  const hasStepHum = Number.isFinite(stepHumidityGoal) && stepHumidityGoal > 0;

  const fruitText = params.recipeFruits?.trim();
  if (!fruitText) {
    return {
      maxTemperature: hasStepTemp ? stepTemperatureGoal : null,
      maxHumidity: hasStepHum ? stepHumidityGoal : null,
      recipeName: params.recipeName ?? null,
      fruitType: null,
      source: hasStepTemp || hasStepHum ? 'recipe-step' : 'none',
    };
  }

  const normalizedFruit = normalize(fruitText);
  const matchedTemp = FRUIT_TEMPERATURE_DEFAULTS.find((profile) =>
    profile.aliases.some((alias) => normalizedFruit.includes(alias)),
  );
  const matched = FRUIT_HUMIDITY_DEFAULTS.find((profile) =>
    profile.aliases.some((alias) => normalizedFruit.includes(alias)),
  );

  if (!matched) {
    return {
      maxTemperature: hasStepTemp
        ? stepTemperatureGoal
        : (matchedTemp?.maxTemperature ?? null),
      maxHumidity: hasStepHum ? stepHumidityGoal : null,
      recipeName: params.recipeName ?? null,
      fruitType: fruitText,
      source: hasStepTemp || hasStepHum ? 'recipe-step' : 'none',
    };
  }

  return {
    maxTemperature: hasStepTemp
      ? stepTemperatureGoal
      : (matchedTemp?.maxTemperature ?? null),
    maxHumidity: hasStepHum ? stepHumidityGoal : matched.maxHumidity,
    recipeName: params.recipeName ?? null,
    fruitType: fruitText,
    source: hasStepTemp || hasStepHum ? 'recipe-step' : 'fruit-default',
  };
}

export function shouldShowManualMessage(nowMs: number): boolean {
  const phase = ((nowMs % 5000) + 5000) % 5000;
  return phase >= 3000;
}

function formatMetric(value: number | undefined, unit: string): string {
  if (!Number.isFinite(value)) return `--${unit}`;
  return `${value!.toFixed(1)}${unit}`;
}

export function buildLcdSnapshot(params: {
  operatingMode: 'auto' | 'manual';
  nowMs: number;
  temperature?: number;
  humidity?: number;
  light?: number;
  lightSensorThreshold: number;
  operatorMessage: string;
}): { line1: string; line2: string; phase: 'sensor' | 'message' } {
  const isMessagePhase =
    params.operatingMode === 'manual' && shouldShowManualMessage(params.nowMs);

  if (isMessagePhase) {
    const safeMessage = params.operatorMessage.trim() || 'No message';
    return {
      line1: `MSG:${safeMessage}`,
      line2: 'Manual control',
      phase: 'message',
    };
  }

  const doorStatus = Number.isFinite(params.light)
    ? params.light! > params.lightSensorThreshold
      ? 'OPEN'
      : 'CLOSE'
    : 'N/A';

  return {
    line1: `T:${formatMetric(params.temperature, 'C')} H:${formatMetric(params.humidity, '%')}`,
    line2: `Door:${doorStatus}`,
    phase: 'sensor',
  };
}
