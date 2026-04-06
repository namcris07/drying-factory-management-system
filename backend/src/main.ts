import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:4000',
  );

  // Enable CORS for the frontend
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // Global prefix for all HTTP routes
  app.setGlobalPrefix('api');

  // Validate & transform incoming DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // MQTT Adafruit duoc khoi tao ben trong MqttService (onModuleInit),
  // khong su dung Nest MQTT microservice transport de tranh chay 2 kenh song song.

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`HTTP Application running on: http://localhost:${port}/api`);
}

void bootstrap();
