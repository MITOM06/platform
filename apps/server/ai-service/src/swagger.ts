import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Shared OpenAPI document config for the ai-service. Used by both the HTTP
 * bootstrap (main.ts) and the standalone generator (generate-openapi.ts).
 *
 * Note: most AI work is driven over RabbitMQ + Redis pub/sub, so the HTTP
 * surface is intentionally small (health/liveness probes).
 */
export function buildAiOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Platform AI Service')
    .setDescription(
      'HTTP surface for the AI service (health/liveness). Core AI request ' +
        'handling is driven over RabbitMQ (ai.requests) and Redis pub/sub ' +
        '(ai:response:{conversationId}).',
    )
    .setVersion('1.0')
    .addTag('health', 'Liveness and health probes')
    .addTag('ai', 'AI service status')
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
  const document = buildAiOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document);
}
