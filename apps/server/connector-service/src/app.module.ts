import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { ConnectionsModule } from './connections/connections.module';

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
    mongooseModule,
    HealthModule,
    ConnectionsModule,
  ],
})
export class AppModule {}
