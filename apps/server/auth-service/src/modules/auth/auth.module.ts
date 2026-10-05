import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { ClaimsService } from './claims.service';
import {
  DatabaseRedisModule,
  User,
  UserSchema,
  Role,
  RoleSchema,
  Department,
  DepartmentSchema,
  Workspace,
  WorkspaceSchema,
} from '@platform/database';
import { OidcService } from './oidc/oidc.service';
import { SsoMappingService } from './oidc/sso-mapping.service';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MailModule } from '../Email/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { InvitationsModule } from '../invitations/invitations.module';
import { InvitationAcceptController } from './invitation-accept.controller';
import { SocialProvisioningService } from './social-provisioning.service';
import { OAuthRedirectService } from './oauth-redirect.service';
import { LoginAttemptsService } from './login-attempts.service';
import { MfaModule } from '../mfa/mfa.module';
import { MfaLoginController } from './mfa-login.controller';

@Module({
  imports: [
    DatabaseRedisModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsersModule,
    MailModule,
    NotificationsModule,
    InvitationsModule,
    MfaModule,
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
  controllers: [AuthController, InvitationAcceptController, MfaLoginController],
  providers: [
    AuthService,
    OtpService,
    SessionService,
    ClaimsService,
    OidcService,
    SsoMappingService,
    SocialProvisioningService,
    OAuthRedirectService,
    LoginAttemptsService,
    JwtStrategy,
    ...(process.env.GOOGLE_CLIENT_ID ? [GoogleStrategy] : []),
  ],
  exports: [AuthService],
})
export class AuthModule {}
