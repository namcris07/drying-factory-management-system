import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto, UpdateBatchDto } from './dto/create-batch.dto';

@Injectable()
export class BatchesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.batch.findMany({
      include: {
        recipe: { select: { recipeID: true, recipeName: true } },
        device: { select: { deviceID: true, deviceName: true } },
        batchOperations: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
      orderBy: { batchesID: 'desc' },
    });
  }

  async findOne(id: number) {
    const batch = await this.prisma.batch.findUnique({
      where: { batchesID: id },
      include: {
        recipe: { include: { steps: { orderBy: { stepNo: 'asc' } } } },
        device: true,
        batchOperations: { orderBy: { startedAt: 'asc' } },
        alerts: { orderBy: { alertTime: 'desc' } },
      },
    });
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  create(dto: CreateBatchDto) {
    return this.prisma.batch.create({
      data: { ...dto, batchStatus: dto.batchStatus ?? 'Running' },
      include: {
        recipe: { select: { recipeID: true, recipeName: true } },
        device: { select: { deviceID: true, deviceName: true } },
      },
    });
  }

  async update(id: number, dto: UpdateBatchDto) {
    await this.findOne(id);
    return this.prisma.batch.update({
      where: { batchesID: id },
      data: dto,
      include: {
        recipe: { select: { recipeID: true, recipeName: true } },
        device: { select: { deviceID: true, deviceName: true } },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.batch.delete({ where: { batchesID: id } });
  }
}
