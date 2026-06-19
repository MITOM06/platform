/**
 * Standalone OpenAPI generator. Builds the Nest application context WITHOUT
 * starting the HTTP server, serialises the OpenAPI 3 document to
 * apps/server/auth-service/openapi.json, then exits.
 *
 * Run via: pnpm --filter @platform/auth-service gen:openapi
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { buildAuthOpenApiDocument } from './swagger';

async function generate() {
  // preview:true builds the DI graph and registers controller/route metadata
  // WITHOUT instantiating providers — so the Mongoose connection factory never
  // runs and no live infra (Mongo/Redis/RabbitMQ) is required. This is enough
  // for Swagger to introspect the route table.
  const app = await NestFactory.create(AppModule, {
    logger: false,
    preview: true,
  });

  const document = buildAuthOpenApiDocument(app);
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
