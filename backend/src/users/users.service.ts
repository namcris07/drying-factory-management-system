import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private readonly userSelect = {
    userID: true,
    firstName: true,
    lastName: true,
    email: true,
    role: true,
    status: true,
    createdAt: true,
    phoneNumber: true,
    zones: { select: { zoneID: true, zoneName: true } },
  } as const;

  private async assignZonesToOperator(
    userID: number,
    chamberIDs: number[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (chamberIDs.length > 0) {
        await tx.zone.updateMany({
          where: { zoneID: { in: chamberIDs } },
          data: { userID },
        });
      }

      await tx.zone.updateMany({
        where: {
          userID,
          ...(chamberIDs.length > 0 ? { zoneID: { notIn: chamberIDs } } : {}),
        },
        data: { userID: null },
      });
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: this.userSelect,
      orderBy: { userID: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { userID: id },
      select: this.userSelect,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hashed,
        role: dto.role,
        phoneNumber: dto.phoneNumber,
        status: 'Active',
        createdAt: new Date(),
      },
      select: this.userSelect,
    });

    const chamberIDs = Array.isArray(dto.chamberIDs)
      ? Array.from(
          new Set(
            dto.chamberIDs.map((item) => Number(item)).filter(Number.isFinite),
          ),
        )
      : [];

    if (String(dto.role ?? '').toLowerCase() === 'operator') {
      await this.assignZonesToOperator(created.userID, chamberIDs);
    }

    return this.findOne(created.userID);
  }

  async update(id: number, dto: UpdateUserDto) {
    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    const updated = await this.prisma.user.update({
      where: { userID: id },
      data,
      select: this.userSelect,
    });

    const nextRole = String(updated.role ?? '').toLowerCase();
    if (nextRole === 'operator') {
      if (dto.chamberIDs !== undefined) {
        const chamberIDs = Array.from(
          new Set(
            dto.chamberIDs.map((item) => Number(item)).filter(Number.isFinite),
          ),
        );
        await this.assignZonesToOperator(updated.userID, chamberIDs);
      }
    } else {
      await this.prisma.zone.updateMany({
        where: { userID: updated.userID },
        data: { userID: null },
      });
    }

    return this.findOne(updated.userID);
  }

  remove(id: number) {
    return this.prisma.user.delete({ where: { userID: id } });
  }
}
