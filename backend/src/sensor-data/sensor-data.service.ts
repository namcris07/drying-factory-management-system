import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SensorDataService {
  constructor(private prisma: PrismaService) {}

  findRecent(deviceId?: number, limit = 50) {
    return this.prisma.sensorDataLog.findMany({
      where: deviceId ? { deviceID: deviceId } : undefined,
      orderBy: { logTimestamp: 'desc' },
      take: limit,
      include: {
        device: { select: { deviceID: true, deviceName: true } },
      },
    });
  }

  findByDevice(deviceId: number, limit = 100) {
    return this.prisma.sensorDataLog.findMany({
      where: { deviceID: deviceId },
      orderBy: { logTimestamp: 'desc' },
      take: limit,
    });
  }
}
