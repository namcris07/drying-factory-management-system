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

  private async getUserScope(actor?: ActorContext) {
    if (!actor || actor.role === 'Admin') return null;
    const user = await this.prisma.user.findUnique({
      where: { userID: actor.userID },
      select: { organizationID: true, factoryID: true, siteID: true },
    });
    if (!user) throw new ForbiddenException('User scope not found.');
    return user;
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
    organizationID: true,
    factoryID: true,
    siteID: true,
    organization: { select: { organizationID: true, organizationName: true } },
    factory: { select: { factoryID: true, factoryName: true } },
    site: { select: { siteID: true, siteName: true } },
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

  async findAll(actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const whereClause: any = {};
    if (scope) {
      if (actor?.role === 'Manager') {
        whereClause.factoryID = scope.factoryID ?? -1;
      } else if (actor?.role === 'Operator') {
        whereClause.userID = actor.userID;
      }
    }

    return this.prisma.user.findMany({
      where: whereClause,
      select: this.userSelect,
      orderBy: { userID: 'asc' },
    });
  }

  async findOne(id: number, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const user = await this.prisma.user.findUnique({
      where: { userID: id },
      select: this.userSelect,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (scope) {
      if (actor?.role === 'Manager' && user.factoryID !== scope.factoryID) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập người dùng này.',
        );
      } else if (actor?.role === 'Operator' && user.userID !== actor.userID) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập người dùng này.',
        );
      }
    }
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

    const scope = await this.getUserScope(actor);
    let organizationID = dto.organizationID;
    let factoryID = dto.factoryID;
    let siteID = dto.siteID;

    if (actor?.role === 'Manager') {
      if (!scope) {
        throw new ForbiddenException(
          'Không tìm thấy phạm vi (scope) của tài khoản.',
        );
      }
      organizationID = scope.organizationID ?? undefined;
      factoryID = scope.factoryID ?? undefined;
      if (dto.siteID) {
        const site = await this.prisma.site.findUnique({
          where: { siteID: dto.siteID },
        });
        if (!site) throw new NotFoundException(`Site ${dto.siteID} not found`);
        if (site.factoryID !== scope.factoryID) {
          throw new ForbiddenException(
            'Bạn chỉ có quyền tạo Operator thuộc phân xưởng của nhà máy mình.',
          );
        }
        siteID = dto.siteID;
      }
    } else if (dto.siteID) {
      const site = await this.prisma.site.findUnique({
        where: { siteID: dto.siteID },
        include: { factory: true },
      });
      if (!site) throw new NotFoundException(`Site ${dto.siteID} not found`);
      siteID = dto.siteID;
      factoryID = factoryID ?? site.factoryID ?? undefined;
      organizationID =
        organizationID ?? site.factory?.organizationID ?? undefined;
    } else if (dto.factoryID) {
      const factory = await this.prisma.factory.findUnique({
        where: { factoryID: dto.factoryID },
      });
      if (!factory)
        throw new NotFoundException(`Factory ${dto.factoryID} not found`);
      organizationID = organizationID ?? factory.organizationID ?? undefined;
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
          organizationID,
          factoryID,
          siteID,
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

    return this.findOne(created.userID, actor);
  }

  async update(id: number, dto: UpdateUserDto, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const existingUser = await this.findOne(id, actor);

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.email !== undefined) data.email = dto.email;

    if (dto.role !== undefined) {
      const nextRole = this.ensureValidRole(dto.role);
      if (actor?.role === 'Manager') {
        if (existingUser.role !== 'Operator') {
          throw new ForbiddenException(
            'Manager chỉ được phép chỉnh sửa tài khoản Operator.',
          );
        }
        if (nextRole !== 'Operator') {
          throw new ForbiddenException(
            'Manager chỉ được phép gán vai trò Operator.',
          );
        }
      }
      data.role = nextRole;
    }

    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    if (actor?.role === 'Manager') {
      if (existingUser.role !== 'Operator') {
        throw new ForbiddenException(
          'Manager chỉ được phép chỉnh sửa tài khoản Operator.',
        );
      }

      if (!scope) {
        throw new ForbiddenException(
          'Không tìm thấy phạm vi (scope) của tài khoản.',
        );
      }
      data.organizationID = scope.organizationID;
      data.factoryID = scope.factoryID;

      if (dto.siteID !== undefined) {
        if (dto.siteID === null) {
          data.siteID = null;
        } else {
          const site = await this.prisma.site.findUnique({
            where: { siteID: dto.siteID },
          });
          if (!site)
            throw new NotFoundException(`Site ${dto.siteID} not found`);
          if (site.factoryID !== scope.factoryID) {
            throw new ForbiddenException(
              'Bạn chỉ có quyền gán Operator vào phân xưởng thuộc nhà máy của mình.',
            );
          }
          data.siteID = dto.siteID;
        }
      }
    } else {
      // Admin or system
      if (dto.organizationID !== undefined)
        data.organizationID = dto.organizationID;
      if (dto.factoryID !== undefined) data.factoryID = dto.factoryID;

      if (dto.siteID !== undefined) {
        if (dto.siteID === null) {
          data.siteID = null;
        } else {
          const site = await this.prisma.site.findUnique({
            where: { siteID: dto.siteID },
            include: { factory: true },
          });
          if (!site)
            throw new NotFoundException(`Site ${dto.siteID} not found`);
          data.siteID = dto.siteID;
          data.factoryID = dto.factoryID ?? site.factoryID ?? undefined;
          data.organizationID =
            dto.organizationID ?? site.factory?.organizationID ?? undefined;
        }
      }
    }

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

    return this.findOne(updated.userID, actor);
  }

  async remove(id: number, actor?: ActorContext) {
    if (actor?.userID === id) {
      throw new ForbiddenException(
        'Không thể tự xóa tài khoản đang đăng nhập.',
      );
    }

    await this.getUserScope(actor);
    const existing = await this.findOne(id, actor);

    if (actor?.role === 'Manager') {
      if (existing.role !== 'Operator') {
        throw new ForbiddenException(
          'Manager chỉ có quyền xóa tài khoản Operator.',
        );
      }
    } else if (existing.role === 'Admin') {
      throw new ForbiddenException('Không thể xóa tài khoản Admin.');
    }

    // Unassign zones
    await this.prisma.zone.updateMany({
      where: { userID: id },
      data: { userID: null },
    });

    return this.prisma.user.delete({ where: { userID: id } });
  }
}
