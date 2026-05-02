import {
  buildLcdSnapshot,
  resolveFormulaThreshold,
  shouldShowManualMessage,
} from './mqtt-logic.util';

describe('mqtt-logic.util', () => {
  describe('resolveFormulaThreshold', () => {
    it('prefers humidity goal from recipe step', () => {
      const result = resolveFormulaThreshold({
        recipeName: 'Xoai gion',
        recipeFruits: 'xoai',
        stepHumidityGoal: 36,
      });

      expect(result).toEqual({
        maxTemperature: 60,
        maxHumidity: 36,
        recipeName: 'Xoai gion',
        fruitType: 'xoai',
        source: 'recipe-step',
      });
    });

    it('falls back to fruit profile when step humidity is missing', () => {
      const result = resolveFormulaThreshold({
        recipeName: 'Mit say',
        recipeFruits: 'mit thai',
        stepHumidityGoal: null,
      });

      expect(result.maxHumidity).toBe(50);
      expect(result.maxTemperature).toBe(62);
      expect(result.source).toBe('fruit-default');
    });

    it('returns none when no recipe data can provide threshold', () => {
      const result = resolveFormulaThreshold({
        recipeName: null,
        recipeFruits: 'chuoi',
      });

      expect(result).toEqual({
        maxTemperature: null,
        maxHumidity: null,
        recipeName: null,
        fruitType: 'chuoi',
        source: 'none',
      });
    });
  });

  describe('shouldShowManualMessage', () => {
    it('shows sensor view in first 3 seconds of 5-second cycle', () => {
      expect(shouldShowManualMessage(1000)).toBe(false);
      expect(shouldShowManualMessage(2999)).toBe(false);
    });

    it('shows message view in last 2 seconds of 5-second cycle', () => {
      expect(shouldShowManualMessage(3000)).toBe(true);
      expect(shouldShowManualMessage(4999)).toBe(true);
    });
  });

  describe('buildLcdSnapshot', () => {
    it('returns sensor metrics in auto mode', () => {
      const snapshot = buildLcdSnapshot({
        operatingMode: 'auto',
        nowMs: 4200,
        temperature: 45,
        humidity: 50,
        light: 50,
        lightSensorThreshold: 90,
        operatorMessage: 'manual message',
      });

      expect(snapshot.phase).toBe('sensor');
      expect(snapshot.line1).toContain('T:45.0C');
      expect(snapshot.line1).toContain('H:50.0%');
      expect(snapshot.line2).toBe('Door:CLOSE');
    });

    it('returns operator message view in manual mode during message phase', () => {
      const snapshot = buildLcdSnapshot({
        operatingMode: 'manual',
        nowMs: 4000,
        temperature: 45,
        humidity: 50,
        light: 250,
        lightSensorThreshold: 90,
        operatorMessage: 'Batch A almost done',
      });

      expect(snapshot.phase).toBe('message');
      expect(snapshot.line1).toContain('MSG:Batch A almost done');
      expect(snapshot.line2).toBe('Manual control');
    });
  });
});
