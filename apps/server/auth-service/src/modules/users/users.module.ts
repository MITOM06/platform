import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from '@platform/database';

@Module({
  imports: [
    // Đăng ký Schema với Mongoose trong phạm vi module này
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Xuất ra để AuthModule có thể sử dụng
})
export class UsersModule {}