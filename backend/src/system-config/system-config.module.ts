import { Module } from '@nestjs/common';
import { SystemConfigController } from './system-config.controller';
import { SystemConfigService } from './system-config.service';
import { SystemConfigUpdateService } from './system-config-update.service';

@Module({
  controllers: [SystemConfigController],
  providers: [SystemConfigService, SystemConfigUpdateService],
  exports: [SystemConfigService, SystemConfigUpdateService],
})
export class SystemConfigModule {}
