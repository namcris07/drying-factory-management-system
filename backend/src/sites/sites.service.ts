import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import type { ActorContext } from '../common/rbac/permissions';

@Injectable()
export class SitesService {
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

  private async generateUniqueSiteCode(name: string): Promise<string> {
    const initials = name
      .split(' ')
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const prefix = initials || 'STE';
    let code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    while (await this.prisma.site.findUnique({ where: { siteCode: code } })) {
      code = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return code;
  }

  async findAll(actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const whereClause: any = {};
    if (scope) {
      if (actor?.role === 'Manager') {
        whereClause.factoryID = scope.factoryID ?? -1;
      } else if (actor?.role === 'Operator') {
        whereClause.siteID = scope.siteID ?? -1;
      }
    }

    return this.prisma.site.findMany({
      where: whereClause,
      include: {
        factory: {
          select: {
            factoryID: true,
            factoryName: true,
            factoryCode: true,
          },
        },
        _count: {
          select: { zones: true, devices: true, users: true },
        },
      },
      orderBy: { siteID: 'asc' },
    });
  }

  async findOne(id: number, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    if (scope) {
      if (actor?.role === 'Manager' && scope.factoryID !== null) {
        // We will verify the site belongs to the manager's factory
        const site = await this.prisma.site.findUnique({
          where: { siteID: id },
        });
        if (site && site.factoryID !== scope.factoryID) {
          throw new ForbiddenException(
            'Bạn không có quyền truy cập phân xưởng này.',
          );
        }
      } else if (actor?.role === 'Operator' && scope.siteID !== id) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập phân xưởng này.',
        );
      }
    }

    const site = await this.prisma.site.findUnique({
      where: { siteID: id },
      include: {
        factory: true,
        zones: true,
        devices: true,
        users: true,
      },
    });
    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site;
  }

  async create(dto: CreateSiteDto, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);

    if (actor && actor.role === 'Operator') {
      throw new ForbiddenException(
        'Nhân viên vận hành không có quyền tạo phân xưởng.',
      );
    }

    // Manager can only create sites inside their own factory.
    if (scope && scope.factoryID !== dto.factoryID) {
      throw new ForbiddenException(
        'Bạn chỉ được phép tạo phân xưởng trực thuộc nhà máy của mình.',
      );
    }

    // Check if factory exists
    const factory = await this.prisma.factory.findUnique({
      where: { factoryID: dto.factoryID },
    });
    if (!factory) {
      throw new NotFoundException(`Factory ${dto.factoryID} not found`);
    }

    const siteCode =
      dto.siteCode || (await this.generateUniqueSiteCode(dto.siteName));

    try {
      return await this.prisma.site.create({
        data: {
          siteName: dto.siteName,
          siteCode,
          factoryID: dto.factoryID,
          status: dto.status || 'Active',
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `A site with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to create site: ' + error.message,
      );
    }
  }

  async update(id: number, dto: Partial<CreateSiteDto>, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const existingSite = await this.findOne(id, actor);

    if (actor && actor.role === 'Operator') {
      throw new ForbiddenException(
        'Nhân viên vận hành không có quyền cập nhật phân xưởng.',
      );
    }

    // Manager can only edit sites in their factory, and cannot move them to another factory.
    if (scope && existingSite.factoryID !== scope.factoryID) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa phân xưởng này.',
      );
    }
    if (scope && dto.factoryID && dto.factoryID !== scope.factoryID) {
      throw new ForbiddenException(
        'Bạn không được phép thay đổi nhà máy trực thuộc phân xưởng sang nhà máy khác.',
      );
    }

    if (dto.factoryID) {
      const factory = await this.prisma.factory.findUnique({
        where: { factoryID: dto.factoryID },
      });
      if (!factory) {
        throw new NotFoundException(`Factory ${dto.factoryID} not found`);
      }
    }

    try {
      return await this.prisma.site.update({
        where: { siteID: id },
        data: dto,
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `A site with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to update site: ' + error.message,
      );
    }
  }

  async remove(id: number, actor?: ActorContext) {
    if (actor && actor.role === 'Operator') {
      throw new ForbiddenException(
        'Nhân viên vận hành không có quyền xóa phân xưởng.',
      );
    }

    const scope = await this.getUserScope(actor);
    const site = await this.findOne(id, actor);

    if (scope && site.factoryID !== scope.factoryID) {
      throw new ForbiddenException('Bạn không có quyền xóa phân xưởng này.');
    }

    if (site.zones && site.zones.length > 0) {
      throw new ConflictException(
        'Không thể xóa khu vực/phân xưởng đang chứa các zone hoạt động. Vui lòng chuyển hoặc xóa các zone trước.',
      );
    }
    if (site.devices && site.devices.length > 0) {
      throw new ConflictException(
        'Không thể xóa khu vực/phân xưởng đang chứa thiết bị/buồng sấy. Vui lòng chuyển hoặc xóa các thiết bị trước.',
      );
    }
    if (site.users && site.users.length > 0) {
      throw new ConflictException(
        'Không thể xóa khu vực/phân xưởng đang có nhân viên phụ trách. Vui lòng phân công lại nhân viên trước.',
      );
    }
    return this.prisma.site.delete({
      where: { siteID: id },
    });
  }
}
