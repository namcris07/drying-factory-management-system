import {
  Controller, Get, Post, Patch,
  Param, Body, ParseIntPipe, Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { ResolveAlertDto, CreateAlertDto } from './dto/resolve-alert.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.alertsService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAlertDto) {
    return this.alertsService.create(dto);
  }

  @Patch(':id/acknowledge')
  acknowledge(@Param('id', ParseIntPipe) id: number) {
    return this.alertsService.acknowledge(id);
  }

  @Patch(':id/resolve')
  resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveAlertDto) {
    return this.alertsService.resolve(id, dto);
  }
}
