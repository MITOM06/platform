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
  // CORS_ORIGINS is a comma-separated list.
  // CORS origins are environment-specific — no single list is correct in both.
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

  // Same class of trap as CORS: WEB_REDIRECT_URL had a 'http://localhost:8081'
  // fallback, so forgetting it in production sent every social/SSO login back to
  // a port on the user's own machine. Fail at boot, not mid-redirect.
  if (isProd && !process.env.WEB_REDIRECT_URL) {
    throw new Error(
      'WEB_REDIRECT_URL must be set in production (OAuth login redirects there).',
    );
  }
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
