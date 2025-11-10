import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'], // linh hoạt môi trường
      validationSchema: Joi.object({
        MONGO_URI: Joi.string().uri().required(),
        // thêm biến khác nếu cần
      }),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri: cfg.get<string>('MONGO_URI', ''),
        // tùy chọn khuyến nghị:
        // dbName: cfg.get<string>('MONGO_DBNAME'),
        // retryAttempts: 5,
        // retryDelay: 2000,
      }),
    }),
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
