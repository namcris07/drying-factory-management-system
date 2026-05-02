import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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

  async create(dto: CreateZoneDto) {
    try {
      return await this.prisma.zone.create({ data: dto });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `A zone with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to create zone: ' + error.message,
      );
    }
  }

  async update(id: number, dto: Partial<CreateZoneDto>) {
    await this.findOne(id);
    return this.prisma.zone.update({ where: { zoneID: id }, data: dto });
  }

  async remove(id: number) {
    const zone = await this.findOne(id);
    if (zone.devices && zone.devices.length > 0) {
      throw new ConflictException(
        'Không thể xóa khu vực đang chứa buồng sấy. Vui lòng chuyển hoặc xóa các buồng sấy trước.',
      );
    }
    return this.prisma.zone.delete({ where: { zoneID: id } });
  }
}
