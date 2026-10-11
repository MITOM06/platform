import { Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { mongoConnectionOptions } from './mongo-options';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) =>
        mongoConnectionOptions(configService.get<string>('MONGO_URI')),
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseMongoModule {}