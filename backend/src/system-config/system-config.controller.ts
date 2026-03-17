import { Controller, Get, Patch, Body } from '@nestjs/common';
import { SystemConfigService } from './system-config.service';

@Controller('system-config')
export class SystemConfigController {
  constructor(private systemConfigService: SystemConfigService) {}

  @Get()
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Patch()
  upsertMany(@Body() data: Record<string, string>) {
    return this.systemConfigService.upsertMany(data);
  }
}
