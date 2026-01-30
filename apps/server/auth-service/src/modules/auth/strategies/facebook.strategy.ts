import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
      scope: ['email', 'public_profile'],
    });
  }

  async validate(_at: string, _rt: string, profile: any, done: any) {
    const { emails, name, photos, displayName } = profile;
    const user = {
      email: emails?.[0]?.value,
      displayName: displayName || `${name.givenName} ${name.familyName}`,
      avatar: photos?.[0]?.value,
    };
    done(null, user);
  }
}