import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseMongoModule, DatabaseRedisModule } from '@platform/database';
import { UsersModule } from './modules/users/users.module';
import { FriendsModule } from './modules/friends/friends.module';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/Email/mail.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // 1. Load biến môi trường
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // 2. Kết nối Database (Lấy từ packages)
    DatabaseMongoModule,
    DatabaseRedisModule,
    MailModule,

    // 3. Modules tính năng
    HealthModule,
    UsersModule,
    FriendsModule,
    AuthModule,
  ],
})
export class AppModule {}