import { Module } from '@nestjs/common';
import { ChambersController } from './chambers.controller';
import { ChambersService } from './chambers.service';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [MqttModule],
  controllers: [ChambersController],
  providers: [ChambersService],
})
export class ChambersModule {}
