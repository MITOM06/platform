import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    });
  }

  async validate(_at: string, _rt: string, profile: any, done: VerifyCallback) {
    const { name, emails, photos, displayName } = profile;
    const user = {
      email: emails[0].value,
      displayName: displayName || `${name.givenName} ${name.familyName}`,
      avatar: photos[0]?.value,
    };
    done(null, user);
  }
}