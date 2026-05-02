import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.analyticsService.getSummary({
      from,
      to,
      zoneId: zoneId ? Number(zoneId) : undefined,
    });
  }

  @Get('trend')
  getTrend(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zoneId') zoneId?: string,
    @Query('period') period?: 'day' | 'week' | 'month' | 'year',
    @Query('status') status?: 'all' | 'success' | 'fail',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.analyticsService.getTrend({
      from,
      to,
      zoneId: zoneId ? Number(zoneId) : undefined,
      period,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('hourly-avg')
  getHourlyAvg(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zoneId') zoneId?: string,
    @Query('metric') metric?: string,
  ) {
    return this.analyticsService.getHourlyAvg({
      from,
      to,
      zoneId: zoneId ? Number(zoneId) : undefined,
      metric,
    });
  }

  @Get('mtbf')
  getMtbf(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.analyticsService.getMtbf({
      from,
      to,
      zoneId: zoneId ? Number(zoneId) : undefined,
    });
  }
}
