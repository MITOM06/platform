import './tracing';
import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonLogger } from './logger';
import helmet from 'helmet';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? '',
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
});

async function bootstrap() {
  const logger = new JsonLogger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  }));

  const port = process.env.PORT ?? 3002;
  await app.listen(port, '0.0.0.0');
  logger.log(`AI Service running on port ${port}`);
}

bootstrap();
