// platform/apps/server/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { JwtModule, JwtModuleOptions, JwtSignOptions } from '@nestjs/jwt';
// Quan trọng: lấy đúng kiểu StringValue từ 'ms'
import type { StringValue } from 'ms';

import { HealthModule } from './health/health.module';
import { MessagesModule } from './messages/messages.module';
import { AuthModule } from './auth/auth.module';
import { WsModule } from './ws/ws.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): MongooseModuleOptions => ({
        uri: cfg.get<string>('MONGO_URI')
          ?? 'mongodb://mongo:27017/chat?replicaSet=rs0',
      }),
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): JwtModuleOptions => {
        const raw = cfg.get<string>('JWT_EXPIRES') ?? '7d';

        // Thu hẹp kiểu: number | StringValue (đúng theo @nestjs/jwt → jsonwebtoken → ms)
        const expiresIn: number | StringValue =
          /^\d+$/.test(raw) ? Number(raw) : (raw as StringValue);

        const signOptions: JwtSignOptions = { expiresIn };

        return {
          secret: cfg.get<string>('JWT_SECRET') ?? 'dev_secret_change_me',
          signOptions,
        };
      },
    }),

    HealthModule,
    AuthModule,
    MessagesModule,
    WsModule,
  ],
})
export class AppModule {}
