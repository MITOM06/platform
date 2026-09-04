import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { findEnvProblems, resolveAllowedOrigins } from './config/env-guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  // Fail closed before anything connects: in production every address and shared
  // secret must be real. Previously a missing env var yielded a service that looked
  // healthy and reached nothing — the same trap auth/ai/chat already close.
  if (isProd) {
    const problems = findEnvProblems(process.env);
    if (problems.length) {
      throw new Error(
        'Refusing to start in production with a development environment:\n  - ' +
          problems.join('\n  - ') +
          '\nSet these to the real values (see infra/docker-compose/.env.mini.example).',
      );
    }
  }

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Restrict CORS to an allow-list. The previous `origin: true` fallback reflected
  // *any* origin back with `credentials: true`, so a missing CLIENT_REDIRECT_URL
  // turned the connector API — OAuth tokens and all — into an open cross-origin
  // endpoint. Production has no fallback: state the origins or do not start.
  const allowedOrigins = resolveAllowedOrigins(process.env);
  if (isProd && allowedOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS must be set in production (or CLIENT_REDIRECT_URL must be a ' +
        'valid URL). Refusing to start with an open CORS policy.',
    );
  }
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      // No Origin header at all: same-origin, curl, or a mobile app — not a
      // browser cross-origin request, so there is nothing to protect against.
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Swagger describes every internal endpoint and its auth shape. Useful locally,
  // needless attack surface in production — matches auth-service and ai-service,
  // which both gate it the same way.
  if (!isProd || process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Platform Connector Service')
      .setDescription(
        'OAuth, encrypted token vault, MCP client, and the internal tools API ' +
          'consumed by ai-service. Exposes catalog, connections, and custom MCP CRUD.',
      )
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  const port = config.get<number>('port') ?? 3003;
  await app.listen(port, '0.0.0.0');
  logger.log(`Connector Service running on port ${port}`);
  logger.log(`CORS allow-list: ${allowedOrigins.join(', ') || '(none)'}`);
}

bootstrap();
