export type SensorMetric = 'temperature' | 'humidity' | 'light' | 'custom';

export type SensorObservation = {
  feed: string;
  normalizedFeed: string;
  metric: SensorMetric;
  rawValue: unknown;
  numericValue: number | null;
};

export type ControlComparator = 'gte' | 'lte';
export type DynamicFanComparator = ControlComparator;

export type DynamicControlRuleLike = {
  id: string;
  enabled: boolean;
  sensorFeed: string;
  comparator: ControlComparator;
  threshold: number;
  targetFeed: string;
  targetValueOn: number;
  targetValueOff: number;
  priority: number;
  cooldownMs: number;
};

export type DynamicFanRuleLike = {
  id: string;
  enabled: boolean;
  sensorFeed: string;
  comparator: DynamicFanComparator;
  threshold: number;
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
  priority: number;
  cooldownMs: number;
};

export type DynamicControlGroupConditionLike = {
  sensorFeed: string;
  comparator: ControlComparator;
  threshold: number;
};

export type DynamicFanGroupConditionLike = DynamicControlGroupConditionLike;

export type DynamicControlGroupOutputLike = {
  targetFeed: string;
  targetValueOn: number;
  targetValueOff: number;
};

export type DynamicFanGroupOutputLike = {
  fanFeed: string;
  fanLevelOn: number;
  fanLevelOff: number;
};

export type DynamicControlGroupRuleLike = {
  id: string;
  enabled: boolean;
  operator: 'AND' | 'OR';
  conditions: DynamicControlGroupConditionLike[];
  outputs: DynamicControlGroupOutputLike[];
  priority: number;
  cooldownMs: number;
};

export type DynamicFanGroupRuleLike = {
  id: string;
  enabled: boolean;
  operator: 'AND' | 'OR';
  conditions: DynamicFanGroupConditionLike[];
  outputs: DynamicFanGroupOutputLike[];
  priority: number;
  cooldownMs: number;
};

export type ControlCandidate = {
  ruleId: string;
  targetFeed: string;
  targetLevel: number;
  priority: number;
  cooldownMs: number;
};

export type RuleCandidate = {
  ruleId: string;
  fanFeed: string;
  targetLevel: number;
  priority: number;
  cooldownMs: number;
};

export function normalizeFeedKey(feed: string): string {
  return String(feed ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function resolveSensorMetric(feed: string): SensorMetric {
  const normalized = normalizeFeedKey(feed);

  if (
    normalized.includes('temperature') ||
    normalized.includes('temp') ||
    normalized.includes('bbctemp')
  ) {
    return 'temperature';
  }

  if (normalized.includes('humidity') || normalized.includes('hum')) {
    return 'humidity';
  }

  if (
    normalized.includes('light') ||
    normalized.includes('lux') ||
    normalized.includes('ldr')
  ) {
    return 'light';
  }

  return 'custom';
}

export class SensorObservationAdapter {
  adapt(feed: string, rawValue: unknown): SensorObservation {
    const normalizedFeed = normalizeFeedKey(feed);
    const numeric = Number(rawValue);

    return {
      feed,
      normalizedFeed,
      metric: resolveSensorMetric(feed),
      rawValue,
      numericValue: Number.isFinite(numeric) ? numeric : null,
    };
  }
}

export interface SensorStrategy {
  supports(metric: SensorMetric): boolean;
  shouldIgnore(observation: SensorObservation): boolean;
}

abstract class BaseSensorStrategy implements SensorStrategy {
  abstract supports(metric: SensorMetric): boolean;

  shouldIgnore(observation: SensorObservation): boolean {
    return observation.numericValue === null;
  }
}

class TemperatureSensorStrategy extends BaseSensorStrategy {
  supports(metric: SensorMetric): boolean {
    return metric === 'temperature';
  }
}

class HumiditySensorStrategy extends BaseSensorStrategy {
  supports(metric: SensorMetric): boolean {
    return metric === 'humidity';
  }
}

class LightSensorStrategy extends BaseSensorStrategy {
  supports(metric: SensorMetric): boolean {
    return metric === 'light';
  }
}

class GenericSensorStrategy extends BaseSensorStrategy {
  supports(metric: SensorMetric): boolean {
    return metric === 'custom';
  }
}

export class SensorStrategyFactory {
  constructor(
    private readonly strategies: SensorStrategy[] = [
      new TemperatureSensorStrategy(),
      new HumiditySensorStrategy(),
      new LightSensorStrategy(),
      new GenericSensorStrategy(),
    ],
  ) {}

  getStrategy(metric: SensorMetric): SensorStrategy {
    return (
      this.strategies.find((strategy) => strategy.supports(metric)) ??
      new GenericSensorStrategy()
    );
  }
}

export class AtomRuleSpecification {
  isSatisfied(
    rule: DynamicControlRuleLike | DynamicFanRuleLike,
    observation: SensorObservation,
  ): boolean {
    if (!rule.enabled) return false;
    if (normalizeFeedKey(rule.sensorFeed) !== observation.normalizedFeed) {
      return false;
    }
    if (observation.numericValue === null) return false;

    return rule.comparator === 'gte'
      ? observation.numericValue >= rule.threshold
      : observation.numericValue <= rule.threshold;
  }

  resolveTargetLevel(
    rule: DynamicControlRuleLike | DynamicFanRuleLike,
    observation: SensorObservation,
  ): number | null {
    if (!this.isSatisfied(rule, observation)) {
      return null;
    }

    return 'targetValueOn' in rule ? rule.targetValueOn : rule.fanLevelOn;
  }

  resolveFallbackLevel(
    rule: DynamicControlRuleLike | DynamicFanRuleLike,
  ): number {
    return 'targetValueOff' in rule ? rule.targetValueOff : rule.fanLevelOff;
  }
}

export class GroupRuleSpecification {
  isSatisfied(
    group: DynamicControlGroupRuleLike | DynamicFanGroupRuleLike,
    observation: SensorObservation,
    resolveFeedValue: (feed: string) => number | null,
    shouldIgnoreFeed: (feed: string, value: number) => boolean,
  ): boolean {
    if (!group.enabled) return false;
    if (group.conditions.length === 0) return false;

    const checks = group.conditions.map((condition) => {
      const sourceValue =
        normalizeFeedKey(condition.sensorFeed) === observation.normalizedFeed
          ? observation.numericValue
          : resolveFeedValue(condition.sensorFeed);

      if (sourceValue === null) return false;
      if (shouldIgnoreFeed(condition.sensorFeed, sourceValue)) return false;

      return condition.comparator === 'gte'
        ? sourceValue >= condition.threshold
        : sourceValue <= condition.threshold;
    });

    return group.operator === 'AND'
      ? checks.every(Boolean)
      : checks.some(Boolean);
  }

  toCandidates(
    group: DynamicControlGroupRuleLike | DynamicFanGroupRuleLike,
    matched: boolean,
  ): RuleCandidate[] {
    return group.outputs.map((output) => ({
      ruleId: group.id,
      fanFeed: 'fanFeed' in output ? output.fanFeed : output.targetFeed,
      targetLevel:
        'fanLevelOn' in output
          ? matched
            ? output.fanLevelOn
            : output.fanLevelOff
          : matched
            ? output.targetValueOn
            : output.targetValueOff,
      priority: group.priority,
      cooldownMs: group.cooldownMs,
    }));
  }
}
