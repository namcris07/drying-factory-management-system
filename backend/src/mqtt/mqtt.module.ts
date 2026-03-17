import { Module } from '@nestjs/common';
import { MqttController } from './mqtt.controller';
import { SensorModule } from '../sensor/sensor.module';

@Module({
  imports: [SensorModule], // Inject SensorModule to access SensorService inside MqttController
  controllers: [MqttController],
})
export class MqttModule {}
