import './tracing';
import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JsonLogger } from './logger';
import { setupSwagger } from './swagger';
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

  // Restrict CORS to an env-driven allowlist instead of reflecting any origin.
  // Mirrors auth-service: CORS_ORIGINS is a comma-separated list; falls back to
  // known web + dev origins. Without this the browser blocks every cross-origin
  // XHR from the web app (e.g. GET /api/sessions/:conversationId).
  const defaultOrigins = [
    'https://platform-web-omega-amber.vercel.app',
    'http://localhost:3000',
    'http://localhost:8081',
  ];
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : defaultOrigins;

  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser clients (no Origin header) and whitelisted origins.
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'ngrok-skip-browser-warning',
      'X-Requested-With',
    ],
  });

  // Swagger UI at /docs (non-production, or when ENABLE_SWAGGER=true).
  setupSwagger(app);

  const port = process.env.PORT ?? 3002;
  await app.listen(port, '0.0.0.0');
  logger.log(`AI Service running on port ${port}`);
}

bootstrap();
