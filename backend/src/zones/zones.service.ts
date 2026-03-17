import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';

@Injectable()
export class ZonesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.zone.findMany({
      include: {
        devices: { select: { deviceID: true } },
      },
      orderBy: { zoneID: 'asc' },
    });
  }

  async findOne(id: number) {
    const zone = await this.prisma.zone.findUnique({
      where: { zoneID: id },
      include: { devices: true },
    });
    if (!zone) throw new NotFoundException(`Zone ${id} not found`);
    return zone;
  }

  create(dto: CreateZoneDto) {
    return this.prisma.zone.create({ data: dto });
  }

  async update(id: number, dto: Partial<CreateZoneDto>) {
    await this.findOne(id);
    return this.prisma.zone.update({ where: { zoneID: id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.zone.delete({ where: { zoneID: id } });
  }
}
