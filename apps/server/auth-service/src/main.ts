import * as Sentry from '@sentry/node';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { JsonLogger } from './logger';
import { setupSwagger } from './swagger';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? '',
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );
  app.use(cookieParser());

  // SESSION_SECRET must be explicitly set in production — a hardcoded fallback
  // would make session signing predictable.
  const isProd = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET;
  if (isProd && !sessionSecret) {
    throw new Error('SESSION_SECRET must be set in production');
  }

  app.use(
    session({
      secret: sessionSecret || 'pon_chat_app_default_secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
      },
    }),
  );

  // Restrict CORS to an env-driven allowlist instead of reflecting any origin.
  // CORS_ORIGINS is a comma-separated list; falls back to known web + dev origins.
  const defaultOrigins = [
    'https://platform-web-omega-amber.vercel.app',
    'http://localhost:3000',
    'http://localhost:8081',
  ];
  const allowedOrigins = (process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : defaultOrigins
  );

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

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger UI at /docs (non-production, or when ENABLE_SWAGGER=true).
  setupSwagger(app);

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  new JsonLogger('Bootstrap').log(`Auth Service running on port ${port}`);
}
bootstrap();
