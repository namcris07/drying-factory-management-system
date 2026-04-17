import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResolveAlertDto, CreateAlertDto } from './dto/resolve-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  findAll(status?: string) {
    return this.prisma.alert.findMany({
      where: status ? { alertStatus: status } : undefined,
      include: {
        device: { select: { deviceID: true, deviceName: true } },
        alertResolutions: {
          orderBy: { resolveTime: 'desc' },
          take: 1,
          include: {
            user: {
              select: {
                userID: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { alertTime: 'desc' },
    });
  }

  async findOne(id: number) {
    const alert = await this.prisma.alert.findUnique({
      where: { alertID: id },
      include: {
        device: true,
        alertResolutions: { orderBy: { resolveTime: 'desc' } },
      },
    });
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  create(dto: CreateAlertDto) {
    return this.prisma.alert.create({
      data: {
        ...dto,
        alertTime: new Date(),
        alertStatus: dto.alertStatus ?? 'pending',
      },
    });
  }

  async acknowledge(id: number) {
    await this.findOne(id);
    return this.prisma.alert.update({
      where: { alertID: id },
      data: { alertStatus: 'acknowledged' },
    });
  }

  async resolve(id: number, dto: ResolveAlertDto) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.alert.update({
        where: { alertID: id },
        data: { alertStatus: 'resolved' },
      });

      return tx.alertResolution.create({
        data: {
          alertID: id,
          userID: dto.userID,
          resolveStatus: dto.resolveStatus,
          resolveNote: dto.resolveNote,
          resolveTime: new Date(),
        },
        include: {
          user: {
            select: {
              userID: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });
  }
}
