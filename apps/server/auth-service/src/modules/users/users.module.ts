import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User, UserSchema } from '../../database/schemas/user.schema';

@Module({
  imports: [
    // Đăng ký Schema với Mongoose trong phạm vi module này
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UsersService],
  exports: [UsersService], // Xuất ra để AuthModule có thể sử dụng
})
export class UsersModule {}