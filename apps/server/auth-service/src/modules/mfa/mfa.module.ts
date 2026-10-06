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
import {
  MfaAdminController,
  MfaSelfController,
} from './mfa-account.controller';
import { MfaAccountService } from './mfa-account.service';
import { MfaChallengeService } from './mfa-challenge.service';
import { MfaCodeService } from './mfa-code.service';
import { MfaCryptoService } from './mfa-crypto.service';
import { MfaPendingStore } from './mfa-pending.store';
import { MfaService } from './mfa.service';

/**
 * Mandatory 2FA (TOTP) for privileged users. AuthModule imports it: login and
 * exchange call MfaChallengeService, and the public /auth/mfa/* endpoints
 * (MfaLoginController, in AuthModule because it issues sessions) call MfaService.
 */
@Module({
  imports: [
    DatabaseRedisModule,
    AuditModule,
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
  ],
  exports: [MfaChallengeService, MfaService],
})
export class MfaModule {}
