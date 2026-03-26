import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * System Config Update Service
 *
 * Logs all configuration updates to the SystemConfigUpdate table
 * for audit trail and history tracking.
 */
@Injectable()
export class SystemConfigUpdateService {
  private readonly logger = new Logger(SystemConfigUpdateService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Log a configuration key update
   */
  async logConfigUpdate(
    configKey: string,
    userId: number | null,
    details?: string,
  ): Promise<void> {
    try {
      await this.prisma.systemConfigUpdate.create({
        data: {
          configKey,
          userID: userId,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Config updated: ${configKey} by user ${userId ?? 'system'} ${details ? `(${details})` : ''}`,
      );
    } catch (error) {
      this.logger.error(`Failed to log config update: ${error.message}`);
    }
  }

  /**
   * Get recent updates for a specific config key
   */
  async getRecentUpdates(configKey: string, limit = 10) {
    return this.prisma.systemConfigUpdate.findMany({
      where: { configKey },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all recent updates across all configs
   */
  async getAllRecentUpdates(limit = 50) {
    return this.prisma.systemConfigUpdate.findMany({
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }
}
