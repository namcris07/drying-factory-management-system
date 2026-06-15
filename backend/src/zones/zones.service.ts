import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import type { ActorContext } from '../common/rbac/permissions';

@Injectable()
export class ZonesService {
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

    return this.prisma.zone.findMany({
      where: whereClause,
      include: {
        devices: { select: { deviceID: true } },
        site: {
          select: {
            siteID: true,
            siteName: true,
            siteCode: true,
          },
        },
      },
      orderBy: { zoneID: 'asc' },
    });
  }

  async findOne(id: number, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const zone = await this.prisma.zone.findUnique({
      where: { zoneID: id },
      include: {
        devices: true,
        site: true,
      },
    });

    if (!zone) throw new NotFoundException(`Zone ${id} not found`);

    if (scope) {
      if (actor?.role === 'Manager' && zone.factoryID !== scope.factoryID) {
        throw new ForbiddenException('Bạn không có quyền truy cập zone này.');
      } else if (actor?.role === 'Operator' && zone.siteID !== scope.siteID) {
        throw new ForbiddenException('Bạn không có quyền truy cập zone này.');
      }
    }

    return zone;
  }

  async create(dto: CreateZoneDto, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);

    if (actor && actor.role === 'Operator') {
      throw new ForbiddenException(
        'Nhân viên vận hành không có quyền tạo zone.',
      );
    }

    let factoryID = dto.factoryID;
    let organizationID = dto.organizationID;

    // Check parent Site validity and auto-resolve factory/org IDs
    if (dto.siteID) {
      const site = await this.prisma.site.findUnique({
        where: { siteID: dto.siteID },
        include: { factory: true },
      });
      if (!site) {
        throw new NotFoundException(`Site ${dto.siteID} not found`);
      }
      if (scope && site.factoryID !== scope.factoryID) {
        throw new ForbiddenException(
          'Bạn chỉ được tạo zone trực thuộc phân xưởng thuộc nhà máy của mình.',
        );
      }
      factoryID = site.factoryID ?? undefined;
      organizationID = site.factory?.organizationID ?? undefined;
    } else if (scope) {
      // If siteID is not provided but scope exists, default to user's scope
      factoryID = scope.factoryID ?? undefined;
      organizationID = scope.organizationID ?? undefined;
    }

    try {
      return await this.prisma.zone.create({
        data: {
          zoneName: dto.zoneName,
          zoneDescription: dto.zoneDescription,
          userID: dto.userID,
          siteID: dto.siteID,
          factoryID,
          organizationID,
        },
      });
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

  async update(id: number, dto: Partial<CreateZoneDto>, actor?: ActorContext) {
    const scope = await this.getUserScope(actor);
    const existingZone = await this.findOne(id, actor);

    if (actor && actor.role === 'Operator') {
      throw new ForbiddenException(
        'Nhân viên vận hành không có quyền cập nhật zone.',
      );
    }

    if (scope && existingZone.factoryID !== scope.factoryID) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa zone này.');
    }

    let factoryID = dto.factoryID;
    let organizationID = dto.organizationID;

    if (dto.siteID) {
      const site = await this.prisma.site.findUnique({
        where: { siteID: dto.siteID },
        include: { factory: true },
      });
      if (!site) {
        throw new NotFoundException(`Site ${dto.siteID} not found`);
      }
      if (scope && site.factoryID !== scope.factoryID) {
        throw new ForbiddenException(
          'Không thể chuyển zone sang phân xưởng ngoài nhà máy của bạn.',
        );
      }
      factoryID = site.factoryID ?? undefined;
      organizationID = site.factory?.organizationID ?? undefined;
    }

    try {
      return await this.prisma.zone.update({
        where: { zoneID: id },
        data: {
          zoneName: dto.zoneName,
          zoneDescription: dto.zoneDescription,
          userID: dto.userID,
          siteID: dto.siteID,
          ...(factoryID ? { factoryID } : {}),
          ...(organizationID ? { organizationID } : {}),
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'unknown field';
        throw new ConflictException(
          `A zone with this ${field} already exists.`,
        );
      }
      throw new InternalServerErrorException(
        'Failed to update zone: ' + error.message,
      );
    }
  }

  async remove(id: number, actor?: ActorContext) {
    if (actor && actor.role === 'Operator') {
      throw new ForbiddenException(
        'Nhân viên vận hành không có quyền xóa zone.',
      );
    }

    const scope = await this.getUserScope(actor);
    const zone = await this.findOne(id, actor);

    if (scope && zone.factoryID !== scope.factoryID) {
      throw new ForbiddenException('Bạn không có quyền xóa zone này.');
    }

    if (zone.devices && zone.devices.length > 0) {
      throw new ConflictException(
        'Không thể xóa khu vực đang chứa buồng sấy. Vui lòng chuyển hoặc xóa các buồng sấy trước.',
      );
    }
    return this.prisma.zone.delete({ where: { zoneID: id } });
  }
}
