import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
