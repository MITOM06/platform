import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseMongoModule, DatabaseRedisModule } from '@platform/database';
import { UsersModule } from './modules/users/users.module';
import { FriendsModule } from './modules/friends/friends.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/Email/mail.module';
import { HealthModule } from './health/health.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 }, // 5 req/s burst protection
      { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/min per IP
    ]),
    DatabaseMongoModule,
    DatabaseRedisModule,
    MailModule,
    HealthModule,
    UsersModule,
    FriendsModule,
    AuthModule,
    WorkspaceModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
