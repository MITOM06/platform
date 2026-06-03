import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3002;
  await app.listen(port, '0.0.0.0');
  Logger.log(`AI Service running on port ${port}`, 'Bootstrap');
}

bootstrap();
