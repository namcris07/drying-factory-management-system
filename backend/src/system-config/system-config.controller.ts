import { Controller, Get, Patch, Body } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';
import { SystemConfigUpdateService } from './system-config-update.service';

@Controller('system-config')
export class SystemConfigController {
  constructor(
    private systemConfigService: SystemConfigService,
    private updateService: SystemConfigUpdateService,
  ) {}

  @Get()
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Get('mode')
  getOperatingMode() {
    return this.systemConfigService.getOperatingMode();
  }

  @Patch('mode')
  async setOperatingMode(
    @Body() dto: { mode: 'auto' | 'manual'; userId?: number },
  ) {
    const result = await this.systemConfigService.setOperatingMode(dto.mode);
    // Log the mode change
    await this.updateService.logConfigUpdate(
      'operatingMode',
      dto.userId ?? null,
      `Changed operating mode to: ${dto.mode}`,
    );
    return result;
  }

  @Patch()
  upsertMany(@Body() data: Record<string, string>) {
    return this.systemConfigService.upsertMany(data);
  }
}
