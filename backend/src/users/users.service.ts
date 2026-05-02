import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ActorContext,
  ActorRole,
  isActorRole,
} from '../common/rbac/permissions';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private ensureValidRole(role: string): ActorRole {
    if (!isActorRole(role)) {
      throw new BadRequestException('Vai trò không hợp lệ.');
    }
    return role;
  }

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

  async create(dto: CreateUserDto, actor?: ActorContext) {
    const role = this.ensureValidRole(dto.role);

    if (actor?.role === 'Manager' && role !== 'Operator') {
      throw new ForbiddenException(
        'Manager chỉ được phép tạo tài khoản Operator.',
      );
    }

    // Check if user already exists by email
    if (dto.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new ConflictException(
          `User with email ${dto.email} already exists.`,
        );
      }
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    let created;
    try {
      created = await this.prisma.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          password: hashed,
          role,
          phoneNumber: dto.phoneNumber,
          status: 'Active',
          createdAt: new Date(),
        },
        select: this.userSelect,
      });
    } catch (error: any) {
      // Handle Prisma unique constraint errors
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `A user with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to create user: ' + error.message,
      );
    }

    const chamberIDs = Array.isArray(dto.chamberIDs)
      ? Array.from(
          new Set(
            dto.chamberIDs.map((item) => Number(item)).filter(Number.isFinite),
          ),
        )
      : [];

    if (role === 'Operator') {
      await this.assignZonesToOperator(created.userID, chamberIDs);
    }

    return this.findOne(created.userID);
  }

  async update(id: number, dto: UpdateUserDto, actor?: ActorContext) {
    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.role !== undefined) {
      const nextRole = this.ensureValidRole(dto.role);
      if (actor?.role === 'Manager' && nextRole !== 'Operator') {
        throw new ForbiddenException(
          'Manager chỉ được phép gán vai trò Operator.',
        );
      }
      data.role = nextRole;
    }
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

  async remove(id: number, actor?: ActorContext) {
    if (actor?.userID === id) {
      throw new ForbiddenException(
        'Không thể tự xóa tài khoản đang đăng nhập.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { userID: id },
      select: { userID: true, role: true },
    });

    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (existing.role === 'Admin') {
      throw new ForbiddenException('Không thể xóa tài khoản Admin.');
    }

    return this.prisma.user.delete({ where: { userID: id } });
  }
}
