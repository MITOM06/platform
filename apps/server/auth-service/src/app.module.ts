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
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiContextModule } from './modules/ai-context/ai-context.module';
import { throttlerOptions } from './modules/auth/throttle';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot(throttlerOptions()),
    DatabaseMongoModule,
    DatabaseRedisModule,
    MailModule,
    HealthModule,
    UsersModule,
    FriendsModule,
    AuthModule,
    WorkspaceModule,
    AdminModule,
    NotificationsModule,
    AiContextModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
