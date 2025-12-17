// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // prefix v1 cho tất cả routes
  app.setGlobalPrefix('v1');

  // bật validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const port = Number(process.env.PORT) || 4000;

  // QUAN TRỌNG: bind 0.0.0.0 để truy cập từ ngoài container
  await app.listen(port, '0.0.0.0');
  console.log(`✅ API started: http://localhost:${port}/v1/health`);
}
bootstrap();
