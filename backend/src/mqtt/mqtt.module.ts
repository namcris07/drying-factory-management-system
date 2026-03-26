import { Module } from '@nestjs/common';
import { MqttController } from './mqtt.controller';
import { MqttService } from './mqtt.service';
import { ModeControlService } from './mode-control.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MqttController],
  providers: [MqttService, ModeControlService],
  exports: [MqttService, ModeControlService],
})
export class MqttModule {}
