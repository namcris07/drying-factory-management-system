import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const ioUsername = configService.get<string>('ADAFRUIT_IO_USERNAME');
  const ioKey = configService.get<string>('ADAFRUIT_IO_KEY');
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3001');

  // Enable CORS for the frontend
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  // Global prefix for all HTTP routes
  app.setGlobalPrefix('api');

  // Validate & transform incoming DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const mqttEnabled =
    ioUsername &&
    ioKey &&
    ioUsername !== 'your_adafruit_username' &&
    ioKey !== 'your_adafruit_aio_key';

  if (mqttEnabled) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.MQTT,
      options: {
        url: 'mqtt://io.adafruit.com:1883',
        username: ioUsername,
        password: ioKey,
        clientId: `mqtt_client_${Math.random().toString(16).substring(2, 10)}`,
        keepalive: 60,
      },
    });
    await app.startAllMicroservices();
    logger.log('MQTT Microservice is actively listening for messages.');
  } else {
    logger.warn('MQTT disabled — set real ADAFRUIT_IO_USERNAME and ADAFRUIT_IO_KEY in .env to enable.');
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`HTTP Application running on: http://localhost:${port}/api`);
}

bootstrap();
