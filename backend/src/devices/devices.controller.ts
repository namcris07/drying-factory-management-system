import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';

@Controller('devices')
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  @Get()
  findAll() {
    return this.devicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.findOne(id);
  }

  @Post('validate-feeds')
  validateFeeds(
    @Body()
    dto: {
      mqttTopicSensor?: string;
      currentDeviceId?: number;
    },
  ) {
    return this.devicesService
      .validateFeedConflicts(dto, dto.currentDeviceId)
      .then(() => ({ ok: true }));
  }

  @Post()
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateDeviceDto>,
  ) {
    return this.devicesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.devicesService.remove(id);
  }
}
