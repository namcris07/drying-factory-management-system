import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { SensorModule } from './sensor/sensor.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ZonesModule } from './zones/zones.module';
import { ChambersModule } from './chambers/chambers.module';
import { DevicesModule } from './devices/devices.module';
import { RecipesModule } from './recipes/recipes.module';
import { BatchesModule } from './batches/batches.module';
import { AlertsModule } from './alerts/alerts.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { SensorDataModule } from './sensor-data/sensor-data.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { FactoriesModule } from './factories/factories.module';
import { SitesModule } from './sites/sites.module';
import { RbacPermissionGuard } from './common/rbac/rbac-permission.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    MqttModule,
    SensorModule,
    AuthModule,
    UsersModule,
    ZonesModule,
    ChambersModule,
    DevicesModule,
    RecipesModule,
    BatchesModule,
    AlertsModule,
    SystemConfigModule,
    SensorDataModule,
    AnalyticsModule,
    OrganizationsModule,
    FactoriesModule,
    SitesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RbacPermissionGuard,
    },
  ],
})
export class AppModule {}
