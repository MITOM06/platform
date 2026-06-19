import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { ClaimsService } from './claims.service';
import {
  DatabaseRedisModule,
  User,
  UserSchema,
  Role,
  RoleSchema,
} from '@platform/database';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TwitterStrategy } from './strategies/x.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MailModule } from '../Email/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    DatabaseRedisModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsersModule,
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_ACCESS_EXPIRES') },
      }),
    }),
    DatabaseRedisModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    ClaimsService,
    JwtStrategy,
    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleStrategy] : []),
    ...(process.env.X_CLIENT_ID ? [TwitterStrategy] : []),
  ],
  exports: [AuthService],
})
export class AuthModule {}
