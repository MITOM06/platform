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
import { resolveClientIp } from './common/client-ip';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'short', ttl: 1000, limit: 5 }, // 5 req/s burst protection
        { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/min per IP
      ],
      // Per CLIENT, not per reverse proxy: the default tracker is req.ip, which
      // behind Caddy/cloudflared is the proxy's address for every user, so the
      // whole company shared one bucket (CLIENT_IP_HEADER / TRUST_PROXY).
      getTracker: (req) => resolveClientIp(req),
    }),
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
