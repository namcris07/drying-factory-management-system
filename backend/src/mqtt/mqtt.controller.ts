import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { PublishCommandDto } from './dto/publish-command.dto';
import { SimulateIncomingDto } from './dto/simulate-incoming.dto';
import { SubscribeFeedsDto } from './dto/subscribe-feeds.dto';
import { MqttService } from './mqtt.service';

@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Get('status')
  getStatus() {
    return this.mqttService.getConnectionStatus();
  }

  @Get('state')
  getState() {
    return this.mqttService.getFeedState();
  }

  @Get('device/:id/state')
  getDeviceState(@Param('id', ParseIntPipe) id: number) {
    return this.mqttService.getDeviceFeedState(id);
  }

  @Post('subscribe')
  @HttpCode(200)
  resubscribe(@Body() body: SubscribeFeedsDto) {
    this.mqttService.subscribeToFeeds(body.feeds);
    return {
      ok: true,
      feeds: body.feeds,
      note: 'Da cap nhat danh sach feed can lang nghe.',
    };
  }

  @Post('command')
  @HttpCode(200)
  async publishCommand(@Body() body: PublishCommandDto) {
    return this.mqttService.publishCommand(
      body.feed,
      body.value,
      body.optimisticSync ?? true,
    );
  }

  @Post('simulate/incoming')
  @HttpCode(200)
  async simulateIncoming(@Body() body: SimulateIncomingDto) {
    return this.mqttService.simulateIncomingFeed(body.feed, body.value);
  }
}
