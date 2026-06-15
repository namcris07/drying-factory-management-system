import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentActor } from '../common/rbac/current-actor.decorator';
import type { ActorContext } from '../common/rbac/permissions';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zoneId') zoneId?: string,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.analyticsService.getSummary(
      {
        from,
        to,
        zoneId: zoneId ? Number(zoneId) : undefined,
      },
      actor,
    );
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
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.analyticsService.getTrend(
      {
        from,
        to,
        zoneId: zoneId ? Number(zoneId) : undefined,
        period,
        status,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
      },
      actor,
    );
  }

  @Get('hourly-avg')
  getHourlyAvg(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zoneId') zoneId?: string,
    @Query('metric') metric?: string,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.analyticsService.getHourlyAvg(
      {
        from,
        to,
        zoneId: zoneId ? Number(zoneId) : undefined,
        metric,
      },
      actor,
    );
  }

  @Get('mtbf')
  getMtbf(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('zoneId') zoneId?: string,
    @CurrentActor() actor?: ActorContext,
  ) {
    return this.analyticsService.getMtbf(
      {
        from,
        to,
        zoneId: zoneId ? Number(zoneId) : undefined,
      },
      actor,
    );
  }
}
