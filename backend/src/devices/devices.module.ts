import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
