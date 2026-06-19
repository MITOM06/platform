import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { SharedJwtStrategy } from '@platform/database';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { ConnectionsModule } from './connections/connections.module';
import { CatalogModule } from './catalog/catalog.module';
import { OAuthModule } from './oauth/oauth.module';
import { InternalModule } from './internal/internal.module';

const mongooseModule: DynamicModule = MongooseModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    uri: configService.get<string>('mongoUri'),
  }),
  inject: [ConfigService],
}) as unknown as DynamicModule;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    mongooseModule,
    HealthModule,
    ConnectionsModule,
    CatalogModule,
    OAuthModule,
    InternalModule,
  ],
  providers: [SharedJwtStrategy],
})
export class AppModule {}
