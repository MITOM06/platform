import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MyDepartmentsController } from './my-departments.controller';
import { MyDepartmentsService } from './my-departments.service';
import { PasswordChangeService } from './password-change.service';
import { SessionService } from '../auth/session.service';
import { FriendsModule } from '../friends/friends.module';
import { FirebaseAdminModule } from '../firebase/firebase.module';
import { SsoModule } from '../sso/sso.module';
import {
  Department,
  DepartmentSchema,
  Role,
  RoleSchema,
  User,
  UserSchema,
  UserBlock,
  UserBlockSchema,
} from '@platform/database';

@Module({
  imports: [
    // Đăng ký Schema với Mongoose trong phạm vi module này
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserBlock.name, schema: UserBlockSchema },
      // Read-only: resolve the role name for /me and public profiles.
      { name: Role.name, schema: RoleSchema },
      // Read-only: names for GET /api/users/me/departments.
      { name: Department.name, schema: DepartmentSchema },
    ]),
    // FriendsService cung cấp số bạn bè + danh sách bạn online cho UsersController
    FriendsModule,
    // FirebaseAdminService xác thực Firebase Phone Auth ID token
    FirebaseAdminModule,
    // Require SSO: /me flags + change-password refusal.
    SsoModule,
  ],
  controllers: [UsersController, MyDepartmentsController],
  // SessionService is stateless over the global REDIS_CLIENT (AdminModule does
  // the same); change-password signs the user's other sessions out.
  providers: [
    UsersService,
    PasswordChangeService,
    SessionService,
    MyDepartmentsService,
  ],
  exports: [UsersService], // Xuất ra để AuthModule có thể sử dụng
})
export class UsersModule {}
