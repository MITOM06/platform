import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { DatabaseRedisModule } from '@platform/database'; 
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    DatabaseRedisModule, 
    UsersModule,
    JwtModule.register({secret: process.env.JWT_ACCESS_SECRET }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService],
})
export class AuthModule {}