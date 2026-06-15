import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import type { ActorContext } from '../common/rbac/permissions';

@Injectable()
export class OrganizationsService {
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

  private async generateUniqueOrgCode(name: string): Promise<string> {
    const initials = name
      .split(' ')
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const prefix = initials || 'ORG';
    let code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    while (
      await this.prisma.organization.findUnique({
        where: { organizationCode: code },
      })
    ) {
      code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return code;
  }

  async findAll(actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const whereClause = scope
      ? { organizationID: scope.organizationID ?? -1 }
      : {};

    return this.prisma.organization.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { factories: true },
        },
      },
      orderBy: { organizationID: 'asc' },
    });
  }

  async findOne(id: number, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    if (scope && scope.organizationID !== id) {
      throw new ForbiddenException('Bạn không có quyền truy cập tổ chức này.');
    }

    const org = await this.prisma.organization.findUnique({
      where: { organizationID: id },
      include: {
        factories: true,
      },
    });
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  async create(dto: CreateOrganizationDto, actor?: ActorContext) {
    if (actor && actor.role !== 'Admin') {
      throw new ForbiddenException(
        'Chỉ có Quản trị viên hệ thống mới được phép tạo tổ chức mới.',
      );
    }

    const orgCode =
      dto.organizationCode ||
      (await this.generateUniqueOrgCode(dto.organizationName));

    try {
      return await this.prisma.organization.create({
        data: {
          organizationName: dto.organizationName,
          organizationCode: orgCode,
          status: dto.status || 'Active',
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `An organization with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to create organization: ' + error.message,
      );
    }
  }

  async update(
    id: number,
    dto: Partial<CreateOrganizationDto>,
    actor?: ActorContext,
  ) {
    if (actor && actor.role !== 'Admin') {
      throw new ForbiddenException(
        'Chỉ có Quản trị viên hệ thống mới được phép cập nhật tổ chức.',
      );
    }

    await this.findOne(id, actor);
    try {
      return await this.prisma.organization.update({
        where: { organizationID: id },
        data: dto,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `An organization with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to update organization: ' + error.message,
      );
    }
  }

  async remove(id: number, actor?: ActorContext) {
    if (actor && actor.role !== 'Admin') {
      throw new ForbiddenException(
        'Chỉ có Quản trị viên hệ thống mới được phép xóa tổ chức.',
      );
    }

    const org = await this.findOne(id, actor);
    if (org.factories && org.factories.length > 0) {
      throw new ConflictException(
        'Không thể xóa tổ chức đang có nhà máy trực thuộc. Vui lòng chuyển hoặc xóa các nhà máy trước.',
      );
    }
    return this.prisma.organization.delete({
      where: { organizationID: id },
    });
  }
}
