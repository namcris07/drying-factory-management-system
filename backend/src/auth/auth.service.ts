import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { zones: { select: { zoneID: true, zoneName: true } } },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.email ||
      'User';
    const zoneNames = user.zones
      .map((z) => z.zoneName)
      .filter(Boolean) as string[];
    const zones = user.zones
      .filter((z) => Boolean(z.zoneName))
      .map((z) => ({ zoneID: z.zoneID, zoneName: z.zoneName as string }));
    const zone =
      user.role === 'Admin' || user.role === 'Manager'
        ? 'All Zones'
        : zoneNames[0] || 'Unknown';

    return {
      id: user.userID,
      name,
      role: user.role,
      zone,
      zones,
      email: user.email,
    };
  }
}
