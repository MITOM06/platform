import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';

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
    const { id, emails, name, photos, displayName } = profile;

    // Facebook không guarantee trả email nếu user không cấp quyền
    const email = emails?.[0]?.value || null;
    const fallbackName = email ? email.split('@')[0] : (name?.givenName || 'User');

    const user = {
      id,                 // ✅ socialId — cần cho ensureUserIdFromSocial
      email,              // ✅ có thể null — ensureUserIdFromSocial sẽ handle
      displayName: displayName ||
        (name?.givenName ? `${name.givenName} ${name.familyName || ''}`.trim() : null) ||
        fallbackName,
      avatar: photos?.[0]?.value || '',
    };

    done(null, user);
  }
}