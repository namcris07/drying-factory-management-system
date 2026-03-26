import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Record<string, string>> {
    const configs = await this.prisma.systemConfig.findMany();
    return configs.reduce(
      (acc, c) => {
        acc[c.configKey] = c.configValue ?? '';
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  async getOperatingMode(): Promise<{ mode: string }> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { configKey: 'operatingMode' },
    });
    const mode = config?.configValue ?? 'auto';
    return { mode };
  }

  async setOperatingMode(mode: 'auto' | 'manual'): Promise<{ mode: string }> {
    await this.prisma.systemConfig.upsert({
      where: { configKey: 'operatingMode' },
      create: { configKey: 'operatingMode', configValue: mode },
      update: { configValue: mode },
    });
    return { mode };
  }

  async upsert(key: string, value: string) {
    return this.prisma.systemConfig.upsert({
      where: { configKey: key },
      create: { configKey: key, configValue: value },
      update: { configValue: value },
    });
  }

  async upsertMany(data: Record<string, string>) {
    const ops = Object.entries(data).map(([key, value]) =>
      this.prisma.systemConfig.upsert({
        where: { configKey: key },
        create: { configKey: key, configValue: value },
        update: { configValue: value },
      }),
    );
    await this.prisma.$transaction(ops);
    return this.findAll();
  }
}
