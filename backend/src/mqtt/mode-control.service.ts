import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mode Control Service
 *
 * Manages two operating modes:
 * 1. AUTO: System makes control decisions based on sensor data (temperature, humidity, etc.)
 *    Example: If temp > maxTempSafe, automatically turn off the drying fan
 * 2. MANUAL: User has direct control; system only relays commands without sensor validation
 *
 * This service:
 * - Determines current operating mode
 * - Decides whether to allow device control based on mode and conditions
 * - Logs all control decisions
 */

export interface ControlDecision {
  allowed: boolean;
  reason: string;
  mode: 'auto' | 'manual';
  action?: string;
}

@Injectable()
export class ModeControlService {
  private readonly logger = new Logger(ModeControlService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get current operating mode from SystemConfig
   */
  async getCurrentMode(): Promise<'auto' | 'manual'> {
    try {
      const config = await this.prisma.systemConfig.findUnique({
        where: { configKey: 'operatingMode' },
      });
      const mode = (config?.configValue ?? 'auto') as 'auto' | 'manual';
      return mode;
    } catch (error) {
      this.logger.error(`Failed to get operating mode: ${error.message}`);
      return 'auto'; // Default to auto for safety
    }
  }

  /**
   * Check if device control is allowed based on current mode and conditions
   *
   * In AUTO mode:
   * - Device controls are locked; user cannot manually override
   * - System auto-controls based on sensor thresholds
   *
   * In MANUAL mode:
   * - User has full control; all device commands are allowed
   */
  async isControlAllowed(): Promise<ControlDecision> {
    const mode = await this.getCurrentMode();

    if (mode === 'manual') {
      return {
        allowed: true,
        reason: 'Manual mode: User has full control',
        mode: 'manual',
      };
    }

    // AUTO mode: Controls are disabled to prevent user interference
    return {
      allowed: false,
      reason: 'Auto mode active: System controls devices automatically',
      mode: 'auto',
    };
  }

  /**
   * Determine AUTO control action based on sensor data
   *
   * Rules:
   * - If temp > maxTempSafe: Turn OFF drying devices (fan, heater)
   * - If humidity < minHumidity: Turn ON humidifier (if exists)
   * - If humidity > maxHumidity: Turn ON ventilation (fan)
   *
   * Returns the action to take (turn on/off which device)
   */
  async getAutoControlAction(sensorData: {
    temperature?: number;
    humidity?: number;
    light?: number;
  }): Promise<{ action: string | null; reason: string }> {
    const mode = await this.getCurrentMode();
    if (mode !== 'auto') {
      return { action: null, reason: 'Not in auto mode' };
    }

    try {
      const config = await this.prisma.systemConfig.findMany({
        where: {
          configKey: {
            in: ['maxTempSafe', 'minHumidity', 'maxHumidity'],
          },
        },
      });

      const configMap = config.reduce(
        (acc, c) => {
          acc[c.configKey] = parseFloat(c.configValue ?? '0');
          return acc;
        },
        {} as Record<string, number>,
      );

      const maxTempSafe = configMap['maxTempSafe'] || 90;
      const minHumidity = configMap['minHumidity'] || 8;
      const maxHumidity = configMap['maxHumidity'] || 85;

      // Rule 1: High temperature -> Turn OFF drying devices
      if (sensorData.temperature && sensorData.temperature > maxTempSafe) {
        return {
          action: 'turn_off_dryer',
          reason: `Temperature ${sensorData.temperature}°C exceeds max ${maxTempSafe}°C`,
        };
      }

      // Rule 2: Low humidity -> Turn ON humidifier
      if (sensorData.humidity && sensorData.humidity < minHumidity) {
        return {
          action: 'turn_on_humidifier',
          reason: `Humidity ${sensorData.humidity}% below minimum ${minHumidity}%`,
        };
      }

      // Rule 3: High humidity -> Turn ON ventilation
      if (sensorData.humidity && sensorData.humidity > maxHumidity) {
        return {
          action: 'turn_on_fan',
          reason: `Humidity ${sensorData.humidity}% exceeds maximum ${maxHumidity}%`,
        };
      }

      return { action: null, reason: 'All sensor values within safe range' };
    } catch (error) {
      this.logger.error(`Failed to get auto control action: ${error.message}`);
      return { action: null, reason: 'Error determining control action' };
    }
  }

  /**
   * Log mode change to audit trail
   */
  async logModeChange(
    userId: number | null,
    fromMode: 'auto' | 'manual',
    toMode: 'auto' | 'manual',
  ): Promise<void> {
    try {
      await this.prisma.systemConfigUpdate.create({
        data: {
          userID: userId,
          configKey: 'operatingMode',
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Mode changed: ${fromMode} -> ${toMode} by user ${userId ?? 'system'}`,
      );
    } catch (error) {
      this.logger.error(`Failed to log mode change: ${error.message}`);
    }
  }
}
