import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SensorService {
  private readonly logger = new Logger(SensorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process and store MQTT sensor data into the SensorDataLog table.
   * The raw deviceId string (from MQTT topic) is embedded in the measurements
   * JSON until Device management is implemented.
   */
  async processAndStoreData(
    deviceId: string,
    sensorType: string,
    value: number,
  ) {
    const log = await this.prisma.sensorDataLog.create({
      data: {
        measurements: { deviceId, sensorType, value },
        logTimestamp: new Date(),
      },
    });

    this.logger.log(
      `Saved sensor data -> Device: ${deviceId}, Type: ${sensorType}, Value: ${value}`,
    );
    return log;
  }
}
