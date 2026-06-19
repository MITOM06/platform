import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Shared OpenAPI document config for the auth-service.
 * Used by both the HTTP bootstrap (main.ts) and the standalone generator
 * (generate-openapi.ts) so the served spec and the committed openapi.json match.
 */
export function buildAuthOpenApiDocument(
  app: INestApplication,
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Platform Auth Service')
    .setDescription(
      'Authentication, OTP, refresh tokens, user search and friends API.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Login, registration, OTP and token endpoints')
    .addTag('users', 'User profile and search')
    .addTag('friends', 'Friend requests and relationships')
    .build();

  return SwaggerModule.createDocument(app, config);
}

/**
 * Mount Swagger UI at /docs. Enabled outside production unless
 * ENABLE_SWAGGER=true is explicitly set.
 */
export function setupSwagger(app: INestApplication): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && process.env.ENABLE_SWAGGER !== 'true') return;
  const document = buildAuthOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document);
}
