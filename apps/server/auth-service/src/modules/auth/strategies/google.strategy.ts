import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['profile', 'email'],
    });
  }

  async validate(_at: string, _rt: string, profile: any, done: VerifyCallback) {
    done(null, toGoogleSocialProfile(profile));
  }
}

/**
 * Normalize a passport-google-oauth20 profile. `emailVerified` is true only
 * when Google asserts it (`emails[0].verified` / userinfo `email_verified`);
 * linking an existing PON account by email requires it.
 */
export function toGoogleSocialProfile(profile: any) {
  const { id, name, emails, photos, displayName } = profile ?? {};
  const email = emails?.[0]?.value;
  const fallbackName = email ? email.split('@')[0] : 'User';
  const verifiedFlag = emails?.[0]?.verified ?? profile?._json?.email_verified;

  return {
    id,
    email,
    emailVerified: verifiedFlag === true || verifiedFlag === 'true',
    displayName:
      displayName ||
      (name?.givenName
        ? `${name.givenName} ${name.familyName || ''}`.trim()
        : null) ||
      fallbackName,
    avatar: photos?.[0]?.value || '',
  };
}
