import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('clientRedirectUrl')
      ? new URL(config.get<string>('clientRedirectUrl')).origin
      : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

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

  const port = config.get<number>('port') ?? 3003;
  await app.listen(port, '0.0.0.0');
  logger.log(`Connector Service running on port ${port}`);
}

bootstrap();
