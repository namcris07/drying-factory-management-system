import { Controller, Logger } from '@nestjs/common';
import {
  MessagePattern,
  Payload,
  Ctx,
  MqttContext,
} from '@nestjs/microservices';
import { SensorService } from '../sensor/sensor.service';

@Controller()
export class MqttController {
  private readonly logger = new Logger(MqttController.name);

  constructor(private readonly sensorService: SensorService) {}

  @MessagePattern('+/feeds/temperature')
  async handleTemperatureData(
    @Payload() data: string,
    @Ctx() context: MqttContext,
  ) {
    const topic = context.getTopic(); // Expected: username/feeds/temperature
    const deviceId = topic.split('/')[0];
    const value = parseFloat(data);

    this.logger.log(`Received temperature from ${deviceId}: ${value}`);

    if (!isNaN(value)) {
      await this.sensorService.processAndStoreData(
        deviceId,
        'temperature',
        value,
      );
    } else {
      this.logger.warn(
        `Invalid temperature format received on topic ${topic}: ${data}`,
      );
    }
  }

  @MessagePattern('+/feeds/humidity')
  async handleHumidityData(
    @Payload() data: string,
    @Ctx() context: MqttContext,
  ) {
    const topic = context.getTopic(); // Expected: username/feeds/humidity
    const deviceId = topic.split('/')[0];
    const value = parseFloat(data);

    this.logger.log(`Received humidity from ${deviceId}: ${value}`);

    if (!isNaN(value)) {
      await this.sensorService.processAndStoreData(deviceId, 'humidity', value);
    } else {
      this.logger.warn(
        `Invalid humidity format received on topic ${topic}: ${data}`,
      );
    }
  }
}
