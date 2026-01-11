import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseMongoModule, DatabaseRedisModule } from '@platform/database';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

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

    // 3. Modules tính năng
    UsersModule,
    AuthModule,
  ],
})
export class AppModule {}