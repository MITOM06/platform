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
  const isProd = process.env.NODE_ENV === 'production';
  // Same fail-open trap chat-service had: every infrastructure address in
  // config/configuration.ts carries a localhost default, so a missing secret
  // yields a healthy-looking revision wired to nothing. Mongo/Redis/RabbitMQ are
  // fatal — the service cannot work without them. Qdrant only degrades (no
  // embeddings, so no RAG and no long-term memory), and its secret is in fact
  // unset in production today, so it warns loudly instead of blocking a deploy.
  if (isProd) {
    const loopback = /localhost|127\.0\.0\.1|::1/i;
    const fatal = [
      ['MONGODB_URI', process.env.MONGODB_URI],
      ['REDIS_URL / REDIS_HOST', process.env.REDIS_URL ?? process.env.REDIS_HOST],
      ['RABBITMQ_URL', process.env.RABBITMQ_URL],
    ].filter(([, v]) => !v || loopback.test(v));
    if (fatal.length) {
      throw new Error(
        `Refusing to start in production with development infrastructure addresses: ${fatal
          .map(([k]) => k)
          .join(', ')}. Set them to the real backing services.`,
      );
    }
    for (const key of ['QDRANT_URL', 'VOYAGE_API_KEY'] as const) {
      const value = process.env[key];
      if (!value || loopback.test(value)) {
        logger.warn(
          `${key} is unset in production — embeddings are disabled, so RAG and ` +
            'long-term memory silently return nothing.',
        );
      }
    }
  }
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  }));

  // Restrict CORS to an env-driven allowlist instead of reflecting any origin.
  // CORS_ORIGINS is a comma-separated list; without it the browser blocks every
  // cross-origin XHR from the web app (e.g. GET /api/sessions/:conversationId).
  // The list is environment-specific — no single value is correct in both.
  // Dev falls back to the local origins; production must state its own and
  // refuses to start otherwise, mirroring chat-service's SecurityConfig. The
  // previous fallback shipped 'http://localhost:3000' to the live API, so a dev
  // origin was whitelisted in production whenever CORS_ORIGINS was unset.
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:8081',
  ];
  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (isProd && configuredOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS must be set in production. Refusing to start with dev origins.',
    );
  }
  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : devOrigins;

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
