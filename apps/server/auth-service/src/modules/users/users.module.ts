import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { FriendsModule } from '../friends/friends.module';
import { SmsModule } from '../sms/sms.module';
import { User, UserSchema, UserBlock, UserBlockSchema } from '@platform/database';

@Module({
  imports: [
    // Đăng ký Schema với Mongoose trong phạm vi module này
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserBlock.name, schema: UserBlockSchema },
    ]),
    // FriendsService cung cấp số bạn bè + danh sách bạn online cho UsersController
    FriendsModule,
    // SmsService cung cấp gửi SMS OTP cho phone verification
    SmsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Xuất ra để AuthModule có thể sử dụng
})
export class UsersModule {}
