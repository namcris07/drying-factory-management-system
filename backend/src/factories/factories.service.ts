import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFactoryDto } from './dto/create-factory.dto';
import type { ActorContext } from '../common/rbac/permissions';

@Injectable()
export class FactoriesService {
  constructor(private prisma: PrismaService) {}

  private async getUserScope(actor?: ActorContext) {
    if (!actor || actor.role === 'Admin') return null;
    const user = await this.prisma.user.findUnique({
      where: { userID: actor.userID },
      select: { organizationID: true, factoryID: true, siteID: true },
    });
    if (!user) throw new ForbiddenException('User scope not found.');
    return user;
  }

  private async generateUniqueFactoryCode(name: string): Promise<string> {
    const initials = name
      .split(' ')
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const prefix = initials || 'FAC';
    let code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    while (
      await this.prisma.factory.findUnique({ where: { factoryCode: code } })
    ) {
      code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return code;
  }

  async findAll(actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const whereClause = scope ? { factoryID: scope.factoryID ?? -1 } : {};

    return this.prisma.factory.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            organizationID: true,
            organizationName: true,
            organizationCode: true,
          },
        },
        _count: {
          select: { sites: true, devices: true },
        },
      },
      orderBy: { factoryID: 'asc' },
    });
  }

  async findOne(id: number, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    if (scope && scope.factoryID !== id) {
      throw new ForbiddenException('Bạn không có quyền truy cập nhà máy này.');
    }

    const factory = await this.prisma.factory.findUnique({
      where: { factoryID: id },
      include: {
        organization: true,
        sites: true,
        devices: true,
      },
    });
    if (!factory) throw new NotFoundException(`Factory ${id} not found`);
    return factory;
  }

  async create(dto: CreateFactoryDto, actor?: ActorContext) {
    if (actor && actor.role !== 'Admin') {
      throw new ForbiddenException(
        'Chỉ có Quản trị viên hệ thống mới được phép tạo nhà máy.',
      );
    }

    // Check if organization exists
    const org = await this.prisma.organization.findUnique({
      where: { organizationID: dto.organizationID },
    });
    if (!org) {
      throw new NotFoundException(
        `Organization ${dto.organizationID} not found`,
      );
    }

    const factoryCode =
      dto.factoryCode ||
      (await this.generateUniqueFactoryCode(dto.factoryName));

    try {
      return await this.prisma.factory.create({
        data: {
          factoryName: dto.factoryName,
          factoryCode,
          organizationID: dto.organizationID,
          status: dto.status || 'Active',
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `A factory with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to create factory: ' + error.message,
      );
    }
  }

  async update(
    id: number,
    dto: Partial<CreateFactoryDto>,
    actor?: ActorContext,
  ) {
    const scope = await this.getUserScope(actor);

    // Only Admin can change factory assignment or modify other factories.
    // Managers can update their own factory name/status.
    if (actor && actor.role === 'Operator') {
      throw new ForbiddenException(
        'Nhân viên vận hành không có quyền cập nhật nhà máy.',
      );
    }
    if (scope && scope.factoryID !== id) {
      throw new ForbiddenException('Bạn không có quyền cập nhật nhà máy này.');
    }

    if (dto.organizationID) {
      if (actor && actor.role !== 'Admin') {
        throw new ForbiddenException(
          'Chỉ có Quản trị viên hệ thống mới được thay đổi tổ chức trực thuộc.',
        );
      }
      const org = await this.prisma.organization.findUnique({
        where: { organizationID: dto.organizationID },
      });
      if (!org) {
        throw new NotFoundException(
          `Organization ${dto.organizationID} not found`,
        );
      }
    }

    try {
      return await this.prisma.factory.update({
        where: { factoryID: id },
        data: dto,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `A factory with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to update factory: ' + error.message,
      );
    }
  }

  async remove(id: number, actor?: ActorContext) {
    if (actor && actor.role !== 'Admin') {
      throw new ForbiddenException(
        'Chỉ có Quản trị viên hệ thống mới được phép xóa nhà máy.',
      );
    }

    const factory = await this.findOne(id, actor);
    if (factory.sites && factory.sites.length > 0) {
      throw new ConflictException(
        'Không thể xóa nhà máy đang chứa phân xưởng trực thuộc. Vui lòng chuyển hoặc xóa các phân xưởng trước.',
      );
    }
    if (factory.devices && factory.devices.length > 0) {
      throw new ConflictException(
        'Không thể xóa nhà máy đang chứa thiết bị/buồng sấy. Vui lòng chuyển hoặc xóa thiết bị trước.',
      );
    }
    return this.prisma.factory.delete({
      where: { factoryID: id },
    });
  }
}
