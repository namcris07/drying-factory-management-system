import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResolveAlertDto, CreateAlertDto } from './dto/resolve-alert.dto';

@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  async findAll(status?: string, page?: number, pageSize?: number) {
    const p = Math.max(1, Number(page ?? 1));
    const ps = Math.min(100, Math.max(1, Number(pageSize ?? 10)));
    const skip = (p - 1) * ps;

    const where = status ? { alertStatus: status } : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.alert.findMany({
        where,
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
                  role: true,
                },
              },
            },
          },
        },
        orderBy: { alertTime: 'desc' },
        skip,
        take: ps,
      }),
      this.prisma.alert.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: p,
        pageSize: ps,
        total,
        totalPages: Math.max(1, Math.ceil(total / ps)),
      },
    };
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
              role: true,
            },
          },
        },
      });
    });
  }
}
