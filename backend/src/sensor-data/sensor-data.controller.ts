import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { SensorDataService } from './sensor-data.service';

@Controller('sensor-data')
export class SensorDataController {
  constructor(private sensorDataService: SensorDataService) {}

  @Get()
  findRecent(
    @Query('deviceId') deviceId?: string,
    @Query('limit') limit?: string,
  ) {
    const devId = deviceId ? parseInt(deviceId, 10) : undefined;
    const lim = limit ? parseInt(limit, 10) : 50;
    return this.sensorDataService.findRecent(devId, lim);
  }
}
