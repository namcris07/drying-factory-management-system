import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.device.findMany({
      include: { zone: { select: { zoneID: true, zoneName: true } } },
      orderBy: { deviceID: 'asc' },
    });
  }

  async findOne(id: number) {
    const device = await this.prisma.device.findUnique({
      where: { deviceID: id },
      include: { zone: { select: { zoneID: true, zoneName: true } } },
    });
    if (!device) throw new NotFoundException(`Device ${id} not found`);
    return device;
  }

  create(dto: CreateDeviceDto) {
    return this.prisma.device.create({
      data: {
        deviceName: dto.deviceName,
        deviceStatus: dto.deviceStatus,
        deviceType: dto.deviceType,
        mqttTopicSensor: dto.mqttTopicSensor,
        mqttTopicCmd: dto.mqttTopicCmd,
        zoneID: dto.zoneID,
        metaData: (dto.metaData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: number, dto: Partial<CreateDeviceDto>) {
    await this.findOne(id);
    return this.prisma.device.update({
      where: { deviceID: id },
      data: {
        deviceName: dto.deviceName,
        deviceStatus: dto.deviceStatus,
        deviceType: dto.deviceType,
        mqttTopicSensor: dto.mqttTopicSensor,
        mqttTopicCmd: dto.mqttTopicCmd,
        zoneID: dto.zoneID,
        metaData: (dto.metaData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.device.delete({ where: { deviceID: id } });
  }
}
