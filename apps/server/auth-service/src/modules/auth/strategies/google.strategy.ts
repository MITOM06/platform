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
    const { id, name, emails, photos, displayName } = profile;
    const email = emails?.[0]?.value;
    const fallbackName = email ? email.split('@')[0] : 'User';

    const user = {
      id,                 
      email,
      displayName: displayName ||
        (name?.givenName ? `${name.givenName} ${name.familyName || ''}`.trim() : null) ||
        fallbackName,
      avatar: photos?.[0]?.value || '',
    };

    done(null, user);
  }
}