/**
 * Standalone OpenAPI generator for the ai-service. Builds the Nest application
 * context WITHOUT starting the HTTP server (no listen, no app.init() so
 * onApplicationBootstrap hooks / bot seeding never run), serialises the
 * OpenAPI 3 document to apps/server/ai-service/openapi.json, then exits.
 *
 * Intentionally does NOT import ./tracing so OpenTelemetry is not initialised.
 *
 * Run via: pnpm --filter @platform/ai-service gen:openapi
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { buildAiOpenApiDocument } from './swagger';

async function generate() {
  // preview:true builds the DI graph and registers controller/route metadata
  // WITHOUT instantiating providers — so no live infra (Mongo/Redis/RabbitMQ)
  // is required. Enough for Swagger to introspect the route table.
  const app = await NestFactory.create(AppModule, {
    logger: false,
    preview: true,
  });

  const document = buildAiOpenApiDocument(app);
  const outPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));

  await app.close();
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outPath}`);
}

generate()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to generate OpenAPI spec:', err);
    process.exit(1);
  });
