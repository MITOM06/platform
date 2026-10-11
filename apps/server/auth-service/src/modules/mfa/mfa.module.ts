import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import {
  DatabaseRedisModule,
  Role,
  RoleSchema,
  User,
  UserSchema,
} from '@platform/database';
import { AuditModule } from '../audit/audit.module';
import { ClaimsService } from '../auth/claims.service';
import { SessionService } from '../auth/session.service';
import { SsoModule } from '../sso/sso.module';
import {
  MfaAdminController,
  MfaSelfController,
} from './mfa-account.controller';
import { MfaAccountService } from './mfa-account.service';
import { MfaChallengeService } from './mfa-challenge.service';
import { MfaCodeService } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { MfaPendingStore } from './mfa-pending.store';
import { MfaSelfService } from './mfa-self.service';
import { MfaService } from './mfa.service';

/**
 * 2FA (TOTP) on password / Google sign-in: mandatory for Owner / Admin-like
 * roles, optional (turned on from Settings) for other members; OIDC SSO, SSO-
 * enforced members and bots are exempt. AuthModule imports it: login and
 * exchange call MfaChallengeService, and the public /auth/mfa/* endpoints
 * (MfaLoginController, in AuthModule because it issues sessions) call MfaService.
 * SsoModule imports none of these modules (no cycle).
 */
@Module({
  imports: [
    DatabaseRedisModule,
    AuditModule,
    SsoModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
  ],
  controllers: [MfaSelfController, MfaAdminController],
  providers: [
    ClaimsService,
    SessionService,
    MfaCryptoService,
    MfaCodeService,
    MfaPendingStore,
    MfaChallengeService,
    MfaService,
    MfaAccountService,
    MfaSelfService,
  ],
  exports: [MfaChallengeService, MfaService],
})
export class MfaModule {}
